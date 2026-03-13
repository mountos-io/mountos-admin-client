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

export class WebAuthnManager {
  constructor(private redis: Redis, private config: WebAuthnConfig) {}

  async listCredentials(userId: string): Promise<StoredCredential[]> {
    const raw = await this.redis.get(KEY_CREDS(userId))
    return raw ? JSON.parse(raw) : []
  }

  async hasCredentials(userId: string): Promise<boolean> {
    return await this.redis.exists(KEY_CREDS(userId)) === 1
  }

  async deleteCredential(userId: string, credentialId: string): Promise<boolean> {
    const creds = await this.listCredentials(userId)
    const filtered = creds.filter(c => c.id !== credentialId)
    if (filtered.length === creds.length) return false
    if (filtered.length === 0) {
      await this.redis.del(KEY_CREDS(userId))
    } else {
      await this.redis.set(KEY_CREDS(userId), JSON.stringify(filtered))
    }
    return true
  }

  async renameCredential(userId: string, credentialId: string, label: unknown): Promise<void> {
    const validated = validateLabel(label)
    const creds = await this.listCredentials(userId)
    const cred = creds.find(c => c.id === credentialId)
    if (!cred) throw new Error('credential not found')
    cred.label = validated
    await this.redis.set(KEY_CREDS(userId), JSON.stringify(creds))
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

    const creds = await this.listCredentials(userId)
    if (creds.length >= MAX_CREDENTIALS) {
      creds.sort((a, b) => a.lastUsedAt.localeCompare(b.lastUsedAt))
      creds.shift()
    }
    creds.push(stored)
    await this.redis.set(KEY_CREDS(userId), JSON.stringify(creds))
    return stored
  }

  async generateAuthenticationOptions(userId: string) {
    const creds = await this.listCredentials(userId)
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

    cred.counter = verification.authenticationInfo.newCounter
    cred.lastUsedAt = new Date().toISOString()
    await this.redis.set(KEY_CREDS(userId), JSON.stringify(creds))

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
