import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createCipheriv, createDecipheriv, createHash, type ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'
import * as OTPAuth from 'otpauth'

// util.promisify can't pick the options-object overload of node:crypto's
// callback-based scrypt on its own — assert the signature we actually use.
const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number, options: ScryptOptions) => Promise<Buffer>

const SCRYPT_KEYLEN = 64
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
export const PASSWORD_ALGO = 'scrypt'
export const MIN_PASSWORD_LENGTH = 8

export async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(password + pepper, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
  return `${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('base64')}:${derived.toString('base64')}`
}

export async function verifyPassword(password: string, pepper: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 5) return false
  const [nStr, rStr, pStr, saltB64, hashB64] = parts
  const N = Number(nStr), r = Number(rStr), p = Number(pStr)
  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  const derived = await scrypt(password + pepper, salt, expected.length, { N, r, p })
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

function totpEncKeyBytes(encKeyB64: string): Buffer {
  const key = Buffer.from(encKeyB64, 'base64')
  if (key.length !== 32) throw new Error('MOUNTOS_PORTAL_TOTP_ENC_KEY must decode to 32 bytes')
  return key
}

// AES-256-GCM at rest for the TOTP secret. Format: iv:tag:ciphertext (base64 each).
export function encryptTotpSecret(secretBase32: string, encKeyB64: string): string {
  const key = totpEncKeyBytes(encKeyB64)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(secretBase32, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, enc].map((b) => b.toString('base64')).join(':')
}

export function decryptTotpSecret(stored: string, encKeyB64: string): string {
  const key = totpEncKeyBytes(encKeyB64)
  const [ivB64, tagB64, encB64] = stored.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const enc = Buffer.from(encB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf-8')
}

const TOTP_ISSUER = 'mountOS Dashboard'

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32
}

export function totpEnrollUri(secretBase32: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  })
  return totp.toString()
}

// window: 2 accepts a code from up to 2 steps (60s) either side of the
// server's clock, to tolerate ordinary clock drift between the server and
// whatever device generated the code. Widening further starts trading real
// security margin for leniency most authenticator apps don't actually need.
const TOTP_VALIDATE_WINDOW = 2

export function verifyTotpCode(secretBase32: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secretBase32),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  })
  return totp.validate({ token: code, window: TOTP_VALIDATE_WINDOW }) !== null
}

// Excludes visually-ambiguous characters (0/O, 1/I/L). 32 chars divides 256
// evenly, so a byte-mod pick introduces no bias.
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const BACKUP_CODE_COUNT = 10

export function generateBackupCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const raw = randomBytes(10)
    let code = ''
    for (let j = 0; j < raw.length; j++) code += BACKUP_CODE_ALPHABET[raw[j] % BACKUP_CODE_ALPHABET.length]
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`)
  }
  return codes
}

function normalizeBackupCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

// Backup codes are already high-entropy random values (~50 bits), so a fast
// keyed hash is enough — no need for scrypt's memory-hardness here.
export function hashBackupCode(code: string, pepper: string): string {
  return createHash('sha256').update(normalizeBackupCode(code) + pepper).digest('hex')
}

export function generateOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashOpaqueToken(token) }
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
