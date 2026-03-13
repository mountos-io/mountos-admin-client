import type Redis from 'ioredis'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type { WebAuthnConfig, StoredCredential } from './types'

const KEY_CREDS = (uid: string) => `mountos:webauthn:creds:${uid}`
const KEY_CHALLENGE = (uid: string) => `mountos:webauthn:challenge:${uid}`
const KEY_STEPUP = (token: string) => `mountos:webauthn:stepup:${token}`

const MAX_CREDENTIALS = 4
const MAX_LABEL_LENGTH = 64
const CHALLENGE_TTL = 120
const STEPUP_TTL = 300

function validateLabel(label: unknown): string {
  if (typeof label !== 'string' || label.length === 0) return 'Security Key'
  if (label.length > MAX_LABEL_LENGTH) throw new Error(`label exceeds ${MAX_LABEL_LENGTH} characters`)
  return label
}

// Lua scripts for atomic credential mutations
const LUA_DELETE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local creds = cjson.decode(raw)
local filtered = {}
local found = false
for _, c in ipairs(creds) do
  if c.id ~= ARGV[1] then filtered[#filtered+1] = c else found = true end
end
if not found then return 0 end
if #filtered == 0 then redis.call('DEL', KEYS[1])
else redis.call('SET', KEYS[1], cjson.encode(filtered)) end
return 1`

const LUA_RENAME = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local creds = cjson.decode(raw)
for _, c in ipairs(creds) do
  if c.id == ARGV[1] then
    c.label = ARGV[2]
    redis.call('SET', KEYS[1], cjson.encode(creds))
    return 1
  end
end
return 0`

const LUA_ADD = `
local raw = redis.call('GET', KEYS[1])
local creds = raw and cjson.decode(raw) or {}
local max = tonumber(ARGV[1])
if #creds >= max then
  table.sort(creds, function(a, b) return a.lastUsedAt < b.lastUsedAt end)
  table.remove(creds, 1)
end
creds[#creds+1] = cjson.decode(ARGV[2])
redis.call('SET', KEYS[1], cjson.encode(creds))
return 1`

const LUA_UPDATE_COUNTER = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local creds = cjson.decode(raw)
for _, c in ipairs(creds) do
  if c.id == ARGV[1] then
    c.counter = tonumber(ARGV[2])
    c.lastUsedAt = ARGV[3]
    redis.call('SET', KEYS[1], cjson.encode(creds))
    return 1
  end
end
return 0`

export class WebAuthnManager {
  constructor(private redis: Redis, private config: WebAuthnConfig) {}

  async listCredentials(userId: string): Promise<StoredCredential[]> {
    const raw = await this.redis.get(KEY_CREDS(userId))
    return raw ? JSON.parse(raw) : []
  }

  async hasCredentials(userId: string): Promise<boolean> {
    const raw = await this.redis.get(KEY_CREDS(userId))
    if (!raw) return false
    const creds = JSON.parse(raw)
    return Array.isArray(creds) && creds.length > 0
  }

  async deleteCredential(userId: string, credentialId: string): Promise<boolean> {
    const result = await this.redis.eval(LUA_DELETE, 1, KEY_CREDS(userId), credentialId)
    return result === 1
  }

  async renameCredential(userId: string, credentialId: string, label: unknown): Promise<void> {
    const validated = validateLabel(label)
    const result = await this.redis.eval(LUA_RENAME, 1, KEY_CREDS(userId), credentialId, validated)
    if (result === 0) throw new Error('credential not found')
  }

  async generateRegistrationOptions(userId: string, userName: string, existing: StoredCredential[]) {
    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpId,
      userName,
      excludeCredentials: existing.map(c => ({
        id: Buffer.from(c.id, 'base64url'),
        transports: c.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })
    await this.redis.set(
      KEY_CHALLENGE(userId),
      JSON.stringify({ challenge: options.challenge }),
      'EX', CHALLENGE_TTL,
    )
    return options
  }

  async verifyRegistration(userId: string, response: unknown, label: unknown): Promise<StoredCredential> {
    const validatedLabel = validateLabel(label)
    const raw = await this.redis.get(KEY_CHALLENGE(userId))
    if (!raw) throw new Error('challenge expired')
    await this.redis.del(KEY_CHALLENGE(userId))
    const { challenge } = JSON.parse(raw)

    const verification = await verifyRegistrationResponse({
      response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge: challenge,
      expectedOrigin: this.config.origin,
      expectedRPID: this.config.rpId,
    })
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('registration verification failed')
    }

    const { credential } = verification.registrationInfo
    const now = new Date().toISOString()
    const stored: StoredCredential = {
      id: Buffer.from(credential.id).toString('base64url'),
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: (credential.transports ?? []) as string[],
      label: validatedLabel,
      createdAt: now,
      lastUsedAt: now,
    }

    await this.redis.eval(LUA_ADD, 1, KEY_CREDS(userId), MAX_CREDENTIALS, JSON.stringify(stored))
    return stored
  }

  async generateAuthenticationOptions(userId: string) {
    const creds = await this.listCredentials(userId)
    if (creds.length === 0) throw new Error('no credentials registered')
    const options = await generateAuthenticationOptions({
      rpID: this.config.rpId,
      allowCredentials: creds.map(c => ({
        id: Buffer.from(c.id, 'base64url'),
        transports: c.transports as AuthenticatorTransport[],
      })),
      userVerification: 'preferred',
    })
    await this.redis.set(
      KEY_CHALLENGE(userId),
      JSON.stringify({ challenge: options.challenge }),
      'EX', CHALLENGE_TTL,
    )
    return options
  }

  async verifyAuthentication(userId: string, response: unknown): Promise<string> {
    const raw = await this.redis.get(KEY_CHALLENGE(userId))
    if (!raw) throw new Error('challenge expired')
    await this.redis.del(KEY_CHALLENGE(userId))
    const { challenge } = JSON.parse(raw)

    const creds = await this.listCredentials(userId)
    const resp = response as Parameters<typeof verifyAuthenticationResponse>[0]['response']
    const credId = resp.id
    const cred = creds.find(c => c.id === credId)
    if (!cred) throw new Error('credential not found')

    const verification = await verifyAuthenticationResponse({
      response: resp,
      expectedChallenge: challenge,
      expectedOrigin: this.config.origin,
      expectedRPID: this.config.rpId,
      credential: {
        id: cred.id,
        publicKey: Buffer.from(cred.publicKey, 'base64url'),
        counter: cred.counter,
        transports: cred.transports as AuthenticatorTransport[],
      },
    })
    if (!verification.verified) throw new Error('authentication verification failed')

    const now = new Date().toISOString()
    await this.redis.eval(
      LUA_UPDATE_COUNTER, 1, KEY_CREDS(userId),
      credId, verification.authenticationInfo.newCounter, now,
    )

    const token = crypto.randomUUID()
    await this.redis.set(KEY_STEPUP(token), userId, 'EX', STEPUP_TTL)
    return token
  }

  async consumeStepUpToken(token: string, userId: string): Promise<boolean> {
    const stored = await this.redis.get(KEY_STEPUP(token))
    if (stored !== userId) return false
    const deleted = await this.redis.del(KEY_STEPUP(token))
    return deleted === 1
  }
}
