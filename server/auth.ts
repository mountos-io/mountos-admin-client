import * as jose from 'jose'
import Redis from 'ioredis'
import { createServerClient, MountOSError, type AdminClient } from '@mountos-io/admin-sdk'
import { ROLE, type AdminUser, type Capabilities, type DashboardAuthConfig } from './types'
import { providerAuthConfig } from '../src/provider/server/config'

const AUD_DASHBOARD = 'mountos/dashboard'
const AUD_SESSION = 'mountos/dashboard/session'
const AUD_REFRESH = 'mountos/dashboard/refresh'
const SYSTEM_ACCOUNT_ID = 0
const SYSTEM_EMAIL_DOMAIN = 'system.local'

const RESOURCES = ['accounts', 'users', 'regions', 'storages', 'volumes', 'auditLogs', 'serviceNodes', 'clientSessions', 'alerts', 'discover', 'vault', 'metrics', 'dashboard', 'license'] as const
const allCaps = (v: number) => Object.fromEntries(RESOURCES.map(r => [r, v]))

const defaults: DashboardAuthConfig = {
  sessionTTL: 24 * 60 * 60,    // 24h
  refreshTTL: 7 * 24 * 60 * 60, // 7d
  roles: {
    [ROLE.superadmin]: allCaps(15), // CRUD
    [ROLE.l1admin]: { ...allCaps(14), vault: 0, metrics: 0 },    // CRU, no delete; vault/metrics: superadmin-only
    [ROLE.l2admin]: { ...allCaps(4), vault: 0, metrics: 0 },     // read-only; vault/metrics: superadmin-only
    // For this role the capability map only drives what the UI renders; the
    // enforced policy is the USER_ROLE_ALLOWED table in authz.ts. `regions`
    // and `storages` are absent even though the volume create form reads both
    // list endpoints: that form does not gate on capabilities, and granting
    // them here would surface the storage/region screens in the UI.
    [ROLE.user]: { volumes: 15, auditLogs: 4, dashboard: 4, clientSessions: 4 }, // volumes: CRUD; rest: R-only
  },
}

// 12-byte SPKI DER prefix for Ed25519 public keys
const ED25519_SPKI_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
])

// 16-byte PKCS#8 DER prefix for Ed25519 private keys
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

function ed25519SpkiPemFromRaw(raw: Uint8Array): string {
  const der = new Uint8Array(ED25519_SPKI_PREFIX.length + raw.length)
  der.set(ED25519_SPKI_PREFIX)
  der.set(raw, ED25519_SPKI_PREFIX.length)
  const b64 = Buffer.from(der).toString('base64')
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`
}

function ed25519Pkcs8PemFromRaw(seed: Buffer): string {
  const der = Buffer.concat([ED25519_PKCS8_PREFIX, seed])
  return `-----BEGIN PRIVATE KEY-----\n${der.toString('base64')}\n-----END PRIVATE KEY-----`
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

// Public keys are always exactly 32 raw bytes (Ed25519 has no 64-byte public
// form) — kept strict. Private keys accept 32 (bare seed) or 64 (Go's
// seed||pubkey ed25519.PrivateKey, what mountos-servers' keygen and this
// repo's own operator keygen produce); the trailing 32 bytes of the 64-byte
// form are a cached copy of the derived public key, not independent secret
// material, so the leading 32-byte seed alone reconstructs the same key.
function decodeEd25519Base64(name: string, b64: string): Buffer {
  const bytes = Buffer.from(b64, 'base64')
  if (bytes.length !== 32 && bytes.length !== 64) {
    throw new Error(`${name}: expected a 32-byte or 64-byte Ed25519 key (base64), got ${bytes.length} bytes`)
  }
  return bytes
}

function importEd25519PublicKey(name: string, b64: string) {
  const bytes = decodeEd25519Base64(name, b64)
  if (bytes.length !== 32) throw new Error(`${name}: expected a 32-byte Ed25519 public key, got ${bytes.length} bytes`)
  return jose.importSPKI(ed25519SpkiPemFromRaw(bytes), 'EdDSA')
}

function importEd25519PrivateKey(name: string, b64: string) {
  const bytes = decodeEd25519Base64(name, b64)
  const seed = bytes.length === 64 ? bytes.subarray(0, 32) : bytes
  return jose.importPKCS8(ed25519Pkcs8PemFromRaw(Buffer.from(seed)), 'EdDSA')
}

function adminUserFromPayload(payload: jose.JWTPayload): AdminUser {
  const role = (payload.role as string) ?? ROLE.l2admin
  const user: AdminUser = {
    id: payload.sub!,
    name: payload.name as string,
    email: payload.email as string | undefined,
    role,
  }
  if (payload.username) user.username = payload.username as string
  if (payload.account_id != null) user.accountId = Number(payload.account_id)
  if (payload.user_id != null) user.userId = Number(payload.user_id)
  if (payload.volume_id != null) user.volumeId = Number(payload.volume_id)
  return user
}

function userRoleClaims(user: AdminUser): Record<string, unknown> {
  const claims: Record<string, unknown> = { name: user.name, email: user.email, role: user.role }
  if (user.username) claims.username = user.username
  if (user.accountId != null) claims.account_id = user.accountId
  if (user.userId != null) claims.user_id = user.userId
  if (user.volumeId != null) claims.volume_id = user.volumeId
  return claims
}

class DashboardAuth {
  private sessionKey!: CryptoKey
  private sessionPub!: CryptoKey
  private providerPub!: CryptoKey
  private redis!: Redis
  private sdk!: AdminClient
  private config: DashboardAuthConfig

  constructor() {
    this.config = { ...defaults, ...providerAuthConfig }
  }

  get sessionTTL() { return this.config.sessionTTL }
  get refreshTTL() { return this.config.refreshTTL }
  get redisClient() { return this.redis }

  async init() {
    this.providerPub = await importEd25519PublicKey('PROVIDER2DASHBOARD_VERIFICATION_KEY', requireEnv('PROVIDER2DASHBOARD_VERIFICATION_KEY'))
    this.sessionKey = await importEd25519PrivateKey('DASHBOARD_SIGNING_KEY', requireEnv('DASHBOARD_SIGNING_KEY'))
    this.sessionPub = await importEd25519PublicKey('DASHBOARD_VERIFICATION_KEY', requireEnv('DASHBOARD_VERIFICATION_KEY'))
    this.redis = new Redis(requireEnv('REDIS_URL'))
    await this.redis.ping()
    this.sdk = createServerClient({
      baseUrl: requireEnv('MOUNTOS_APPSERV_URL'),
      privateKey: requireEnv('MOUNTOS_SDK_SIGNING_KEY'),
    })
    console.log('Auth: keys loaded, Redis connected')
  }

  async validateProviderToken(token: string): Promise<AdminUser> {
    const { payload } = await jose.jwtVerify(token, this.providerPub, {
      audience: AUD_DASHBOARD,
      clockTolerance: 60,
      maxTokenAge: '120s',
    })
    const user = adminUserFromPayload(payload)
    if (user.username) {
      if (user.role === ROLE.user) {
        if (user.accountId == null) throw new Error('user role requires account_id claim')
        const match = await this.findActiveUser(user.accountId, user.username)
        if (!match) throw new Error('no active user found for account')
        user.userId = match.id
      } else {
        const match = await this.findOrCreateSystemUser(user)
        user.userId = match.id
      }
    } else if (user.role === ROLE.user) {
      throw new Error('user role requires username claim')
    }
    return user
  }

  async signSessionToken(user: AdminUser): Promise<string> {
    return new jose.SignJWT(userRoleClaims(user))
      .setProtectedHeader({ alg: 'EdDSA' })
      .setSubject(user.id)
      .setAudience(AUD_SESSION)
      .setIssuedAt()
      .setExpirationTime(`${this.config.sessionTTL}s`)
      .setJti(crypto.randomUUID())
      .sign(this.sessionKey)
  }

  async signRefreshToken(user: AdminUser): Promise<string> {
    const jti = crypto.randomUUID()
    const token = await new jose.SignJWT(userRoleClaims(user))
      .setProtectedHeader({ alg: 'EdDSA' })
      .setSubject(user.id)
      .setAudience(AUD_REFRESH)
      .setIssuedAt()
      .setExpirationTime(`${this.config.refreshTTL}s`)
      .setJti(jti)
      .sign(this.sessionKey)
    const pipeline = this.redis.pipeline()
      .set(`mountos:refresh:${jti}`, user.id, 'EX', this.config.refreshTTL)
    if (user.username) {
      const setKey = `mountos:user-refresh:${user.username}`
      pipeline.sadd(setKey, jti).expire(setKey, this.config.refreshTTL)
    }
    await pipeline.exec()
    return token
  }

  async verifySessionToken(token: string): Promise<AdminUser> {
    const { payload } = await jose.jwtVerify(token, this.sessionPub, {
      audience: AUD_SESSION,
    })
    return adminUserFromPayload(payload)
  }

  async verifyRefreshToken(token: string): Promise<AdminUser> {
    const { payload } = await jose.jwtVerify(token, this.sessionPub, {
      audience: AUD_REFRESH,
    })
    if (!payload.jti || !await this.redis.del(`mountos:refresh:${payload.jti}`)) {
      throw new Error('refresh token already consumed')
    }
    if (payload.username) await this.redis.srem(`mountos:user-refresh:${payload.username}`, payload.jti)
    return adminUserFromPayload(payload)
  }

  resolveCapabilities(role: string): Capabilities {
    return this.config.roles[role] ?? this.config.roles[ROLE.l2admin] ?? allCaps(4)
  }

  private async findActiveUser(accountId: number, username: string) {
    const { items } = await this.sdk.users.list({ accountId, search: username, page: 1, limit: 10 })
    return items.find(u => u.username === username && u.isActive) ?? null
  }

  private async findOrCreateSystemUser(user: AdminUser) {
    const match = await this.findActiveUser(SYSTEM_ACCOUNT_ID, user.username!)
    if (match) return match
    try {
      const res = await this.sdk.users.add({
        accountId: SYSTEM_ACCOUNT_ID,
        username: user.username!,
        email: user.email ?? `${user.username}@${SYSTEM_EMAIL_DOMAIN}`,
        name: user.name,
      })
      return { id: res.id }
    } catch (err) {
      if (err instanceof MountOSError && err.status === 409) {
        const retry = await this.findActiveUser(SYSTEM_ACCOUNT_ID, user.username!)
        if (retry) return retry
      }
      throw err
    }
  }

  async fetchAccountForUser(accountId: number) {
    return this.sdk.accounts.get(accountId)
  }

  async revokeRefreshToken(token: string) {
    try {
      const { jti, username } = jose.decodeJwt(token) as jose.JWTPayload & { username?: string }
      if (jti) {
        await this.redis.del(`mountos:refresh:${jti}`)
        if (username) await this.redis.srem(`mountos:user-refresh:${username}`, jti)
      }
    } catch (e) {
      console.warn('Failed to revoke refresh token:', e)
    }
  }

  async revokeUserSessions(username: string): Promise<number> {
    const setKey = `mountos:user-refresh:${username}`
    const jtis = await this.redis.smembers(setKey)

    const pipeline = this.redis.pipeline()
    for (const jti of jtis) pipeline.del(`mountos:refresh:${jti}`)
    pipeline.del(setKey)
    pipeline.set(`mountos:revoked:${username}`, '1', 'EX', this.config.sessionTTL)
    await pipeline.exec()

    return jtis.length
  }

  async isUserRevoked(username: string | undefined): Promise<boolean> {
    if (!username) return false
    return await this.redis.exists(`mountos:revoked:${username}`) === 1
  }
}

export const dashboardAuth = new DashboardAuth()
