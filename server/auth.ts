import * as jose from 'jose'
import Redis from 'ioredis'
import type { AdminUser, Capabilities, DashboardAuthConfig } from './types'
import { vendorAuthConfig } from '../src/vendor/server/config'

const AUD_DASHBOARD = 'mountos/dashboard'
const AUD_SESSION = 'mountos/dashboard/session'
const AUD_REFRESH = 'mountos/dashboard/refresh'

const RESOURCES = ['accounts', 'users', 'regions', 'storages', 'volumes', 'auditLogs', 'serviceNodes', 'discover', 'cache'] as const
const allCaps = (v: number) => Object.fromEntries(RESOURCES.map(r => [r, v]))

const defaults: DashboardAuthConfig = {
  sessionTTL: 24 * 60 * 60,    // 24h
  refreshTTL: 7 * 24 * 60 * 60, // 7d
  roles: {
    superadmin: allCaps(15), // CRUD
    l1admin: allCaps(14),    // CRU, no delete
    l2admin: allCaps(4),     // read-only
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

function assertEd25519Key(name: string, b64: string) {
  if (b64.length !== 44) throw new Error(`${name}: expected 44-char base64 (32 bytes), got ${b64.length}`)
  const bytes = Buffer.from(b64, 'base64')
  if (bytes.length !== 32) throw new Error(`${name}: expected 32 raw bytes, got ${bytes.length}`)
  return bytes
}

function importEd25519PublicKey(name: string, b64: string) {
  const bytes = assertEd25519Key(name, b64)
  return jose.importSPKI(ed25519SpkiPemFromRaw(bytes), 'EdDSA')
}

function importEd25519PrivateKey(name: string, b64: string) {
  const bytes = assertEd25519Key(name, b64)
  return jose.importPKCS8(ed25519Pkcs8PemFromRaw(bytes), 'EdDSA')
}

class DashboardAuth {
  private sessionKey!: jose.KeyLike
  private sessionPub!: jose.KeyLike
  private vendorPub!: jose.KeyLike
  private redis!: Redis
  private config: DashboardAuthConfig

  constructor() {
    this.config = { ...defaults, ...vendorAuthConfig }
  }

  get sessionTTL() { return this.config.sessionTTL }
  get refreshTTL() { return this.config.refreshTTL }

  async init() {
    this.vendorPub = await importEd25519PublicKey('VENDOR2DASHBOARD_VERIFICATION_KEY', process.env.VENDOR2DASHBOARD_VERIFICATION_KEY!)
    this.sessionKey = await importEd25519PrivateKey('DASHBOARD_SIGNING_KEY', process.env.DASHBOARD_SIGNING_KEY!)
    this.sessionPub = await importEd25519PublicKey('DASHBOARD_VERIFICATION_KEY', process.env.DASHBOARD_VERIFICATION_KEY!)
    this.redis = new Redis(process.env.REDIS_URL!)
    await this.redis.ping()
    console.log('Auth: keys loaded, Redis connected')
  }

  async validateVendorToken(token: string): Promise<AdminUser> {
    const { payload } = await jose.jwtVerify(token, this.vendorPub, {
      audience: AUD_DASHBOARD,
      clockTolerance: 60,
      maxTokenAge: '120s',
    })
    return {
      id: payload.sub!,
      name: payload.name as string,
      email: payload.email as string | undefined,
      role: (payload.role as string) ?? 'l2admin',
    }
  }

  async signSessionToken(user: AdminUser): Promise<string> {
    return new jose.SignJWT({ name: user.name, email: user.email, role: user.role })
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
    const token = await new jose.SignJWT({ name: user.name, email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setSubject(user.id)
      .setAudience(AUD_REFRESH)
      .setIssuedAt()
      .setExpirationTime(`${this.config.refreshTTL}s`)
      .setJti(jti)
      .sign(this.sessionKey)
    await this.redis.set(`mountos:refresh:${jti}`, user.id, 'EX', this.config.refreshTTL)
    return token
  }

  async verifySessionToken(token: string): Promise<AdminUser> {
    const { payload } = await jose.jwtVerify(token, this.sessionPub, {
      audience: AUD_SESSION,
    })
    return {
      id: payload.sub!,
      name: payload.name as string,
      email: payload.email as string | undefined,
      role: (payload.role as string) ?? 'l2admin',
    }
  }

  async verifyRefreshToken(token: string): Promise<AdminUser> {
    const { payload } = await jose.jwtVerify(token, this.sessionPub, {
      audience: AUD_REFRESH,
    })
    if (!payload.jti || !await this.redis.del(`mountos:refresh:${payload.jti}`)) {
      throw new Error('refresh token already consumed')
    }
    return {
      id: payload.sub!,
      name: payload.name as string,
      email: payload.email as string | undefined,
      role: (payload.role as string) ?? 'l2admin',
    }
  }

  resolveCapabilities(role: string): Capabilities {
    return this.config.roles[role] ?? this.config.roles['l2admin'] ?? allCaps(4)
  }

  async revokeRefreshToken(token: string) {
    try {
      const { jti } = jose.decodeJwt(token)
      if (jti) await this.redis.del(`mountos:refresh:${jti}`)
    } catch {}
  }
}

export const dashboardAuth = new DashboardAuth()
