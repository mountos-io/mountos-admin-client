import { describe, it, expect } from 'vitest'
import {
  hashPassword, verifyPassword,
  encryptTotpSecret, decryptTotpSecret,
  generateTotpSecret, totpEnrollUri, verifyTotpCode,
  generateBackupCodes, hashBackupCode, BACKUP_CODE_COUNT,
  generateOpaqueToken, hashOpaqueToken,
} from './crypto'
import * as OTPAuth from 'otpauth'

const PEPPER = 'test-pepper'
const ENC_KEY = Buffer.alloc(32, 7).toString('base64')

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple', PEPPER)
    expect(await verifyPassword('correct horse battery staple', PEPPER, hash)).toBe(true)
    expect(await verifyPassword('wrong password', PEPPER, hash)).toBe(false)
  })

  it('rejects when the pepper differs', async () => {
    const hash = await hashPassword('password', PEPPER)
    expect(await verifyPassword('password', 'other-pepper', hash)).toBe(false)
  })

  it('rejects malformed stored hashes instead of throwing', async () => {
    expect(await verifyPassword('password', PEPPER, '')).toBe(false)
    expect(await verifyPassword('password', PEPPER, 'not-a-real-hash')).toBe(false)
  })

  it('produces a different salt (and hash) every time', async () => {
    const a = await hashPassword('same-password', PEPPER)
    const b = await hashPassword('same-password', PEPPER)
    expect(a).not.toBe(b)
  })
})

describe('TOTP secret encryption at rest', () => {
  it('round-trips through encrypt/decrypt', () => {
    const secret = generateTotpSecret()
    const enc = encryptTotpSecret(secret, ENC_KEY)
    expect(decryptTotpSecret(enc, ENC_KEY)).toBe(secret)
  })

  it('fails to decrypt with the wrong key', () => {
    const secret = generateTotpSecret()
    const enc = encryptTotpSecret(secret, ENC_KEY)
    const otherKey = Buffer.alloc(32, 9).toString('base64')
    expect(() => decryptTotpSecret(enc, otherKey)).toThrow()
  })
})

describe('TOTP codes', () => {
  it('accepts the current code and rejects an arbitrary one', () => {
    const secret = generateTotpSecret()
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), algorithm: 'SHA1', digits: 6, period: 30 })
    const code = totp.generate()
    expect(verifyTotpCode(secret, code)).toBe(true)
    expect(verifyTotpCode(secret, '000000')).toBe(false)
  })

  it('embeds the account email in the enrollment URI', () => {
    const secret = generateTotpSecret()
    const uri = totpEnrollUri(secret, 'admin@example.com')
    expect(uri).toContain('admin%40example.com')
  })
})

describe('backup codes', () => {
  it('generates the expected count, each verifiable by its own hash only', () => {
    const codes = generateBackupCodes()
    expect(codes).toHaveLength(BACKUP_CODE_COUNT)
    expect(new Set(codes).size).toBe(BACKUP_CODE_COUNT)

    const hash = hashBackupCode(codes[0], PEPPER)
    expect(hashBackupCode(codes[0], PEPPER)).toBe(hash)
    expect(hashBackupCode(codes[1], PEPPER)).not.toBe(hash)
  })

  it('normalizes case and separators before hashing', () => {
    const codes = generateBackupCodes()
    const raw = codes[0]
    const messy = raw.toLowerCase().replace('-', '')
    expect(hashBackupCode(raw, PEPPER)).toBe(hashBackupCode(messy, PEPPER))
  })
})

describe('opaque tokens', () => {
  it('hashes deterministically and each token is unique', () => {
    const a = generateOpaqueToken()
    const b = generateOpaqueToken()
    expect(a.token).not.toBe(b.token)
    expect(hashOpaqueToken(a.token)).toBe(a.hash)
    expect(hashOpaqueToken(a.token)).not.toBe(hashOpaqueToken(b.token))
  })
})
