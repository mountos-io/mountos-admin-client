import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { WebAuthnManager } from '../webauthn'
import { dashboardAuth } from '../auth'
import { ROLE, isAdmin, type AdminUser } from '../types'
import { issueSession } from '../session'
import { authFailuresTotal } from '../metrics'
import { loadLocalAuthConfig } from './config'
import { initPortalDb } from './db'
import { PortalStore } from './store'
import { PORTAL_STATUS, TOKEN_KIND, type PortalUser } from './types'
import { initEmailSender, sendInviteEmail, sendPasswordResetEmail } from './email'
import {
  hashPassword, verifyPassword, PASSWORD_ALGO, MIN_PASSWORD_LENGTH,
  generateTotpSecret, totpEnrollUri, verifyTotpCode,
  encryptTotpSecret, decryptTotpSecret,
  generateBackupCodes, hashBackupCode,
  generateOpaqueToken, hashOpaqueToken,
} from './crypto'

const MFA_CHALLENGE_TTL = 300
const TOTP_SETUP_TTL = 600
const INVITE_TTL = 7 * 24 * 60 * 60
const RESET_TTL = 60 * 60
const RESEND_COOLDOWN_SECONDS = 3 * 60

const keyMfa = (challengeId: string) => `mountos:localauth:mfa:${challengeId}`
const keySetup = (setupToken: string) => `mountos:localauth:setup:${setupToken}`
const keyEnroll = (userId: string) => `mountos:localauth:enroll:${userId}`

interface PendingTotp {
  userId: string
  secretBase32: string
}

// c.req.json() rejects on an empty/invalid body — every route here treats
// that the same as "fields missing", so fall back to {} (all fields optional
// on every request type below) rather than letting the rejection bubble up.
async function readJson<T extends object>(c: Context): Promise<Partial<T>> {
  return c.req.json<T>().catch(() => ({}))
}

// The DB write (invite row, token, password change) is the durable half of
// these operations and must not roll back just because the email provider is
// down or misconfigured — that would also turn "does this email have an
// account" into an observable 200-vs-500 side channel on password/forgot.
// Callers report `emailSent` so the UI can say "created, but delivery failed."
async function trySendEmail(send: () => Promise<void>): Promise<boolean> {
  try {
    await send()
    return true
  } catch (e) {
    console.error('localauth: email send failed:', e)
    return false
  }
}

function portalUserToAdmin(user: PortalUser): AdminUser {
  // `username` here is not an appserv login handle — this account never goes
  // through the provider/appserv username lookup. It only powers auth.ts's
  // per-user refresh-jti tracking and revokeUserSessions/isUserRevoked (both
  // keyed by `username`), so a stable unique value is all that's required.
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    username: user.email,
    accountId: user.accountId ?? undefined,
    userId: user.appservUserId ?? undefined,
  }
}

export async function createLocalAuthRoutes({ webauthnManager }: { webauthnManager: WebAuthnManager }) {
  const cfg = loadLocalAuthConfig()
  const pool = initPortalDb(cfg.databaseUrl)
  await pool.query('SELECT 1') // fail fast on a bad connection string at boot, not on first request
  const store = new PortalStore(pool)
  await initEmailSender(cfg.emailProvider, cfg.emailFrom)
  const redis = dashboardAuth.redisClient

  // Normalizes login timing whether or not the email exists, so response
  // latency doesn't reveal account existence.
  const dummyHash = await hashPassword('not-a-real-password', cfg.passwordPepper)

  async function startTotpSetup(user: PortalUser): Promise<{ setupToken: string; secretBase32: string; otpauthUri: string }> {
    const setupToken = generateOpaqueToken().token
    const secretBase32 = generateTotpSecret()
    const pending: PendingTotp = { userId: user.id, secretBase32 }
    await redis.set(keySetup(setupToken), JSON.stringify(pending), 'EX', TOTP_SETUP_TTL)
    return { setupToken, secretBase32, otpauthUri: totpEnrollUri(secretBase32, user.email) }
  }

  async function finishTotpEnrollment(user: PortalUser, secretBase32: string): Promise<string[]> {
    await store.enableTotp(user.id, encryptTotpSecret(secretBase32, cfg.totpEncKey))
    const backupCodes = generateBackupCodes()
    await store.replaceBackupCodes(user.id, backupCodes.map((code) => hashBackupCode(code, cfg.passwordPepper)))
    return backupCodes
  }

  // Shared "prove you still control the current factor" check, used by every
  // action that changes or removes a factor (2FA rotation, backup-code
  // regeneration, passkey removal). A TOTP code takes priority; a backup code
  // is only consumed when the TOTP check itself didn't match.
  async function verifyCurrentFactor(user: PortalUser, code: string | undefined): Promise<boolean> {
    if (!code) return false
    if (user.totpSecretEnc && verifyTotpCode(decryptTotpSecret(user.totpSecretEnc, cfg.totpEncKey), code)) {
      return true
    }
    return store.consumeBackupCode(user.id, hashBackupCode(code, cfg.passwordPepper))
  }

  const requireSession: MiddlewareHandler = async (c, next) => {
    const authHeader = c.req.header('authorization')
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const token = bearer ?? getCookie(c, 'mountos_session')
    if (!token) return c.json({ status: 'failure', message: 'unauthorized' }, 401)
    try {
      const user = await dashboardAuth.verifySessionToken(token)
      if (await dashboardAuth.isUserRevoked(user.username)) {
        return c.json({ status: 'failure', message: 'session revoked' }, 401)
      }
      c.set('mountosUser', user)
      await next()
    } catch {
      return c.json({ status: 'failure', message: 'unauthorized' }, 401)
    }
  }

  const app = new Hono()

  app.get('/api/auth/local/config', (c) => c.json({ enabled: true }))

  app.post('/api/auth/local/login', async (c) => {
    const body = await readJson<{ email: string; password: string }>(c)
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    if (!email || !password) return c.json({ status: 'failure', message: 'invalid credentials' }, 401)

    const user = await store.findByEmail(email)
    const loginable = user && user.status === PORTAL_STATUS.active
    const valid = await verifyPassword(password, cfg.passwordPepper, loginable ? user.passwordHash : dummyHash)
    if (!loginable || !valid) {
      authFailuresTotal.inc({ type: 'local_login' })
      return c.json({ status: 'failure', message: 'invalid credentials' }, 401)
    }

    const hasPasskey = await webauthnManager.hasCredentials(user.id)
    if (user.totpEnabledAt || hasPasskey) {
      const challengeId = generateOpaqueToken().token
      await redis.set(keyMfa(challengeId), user.id, 'EX', MFA_CHALLENGE_TTL)
      return c.json({ status: 'mfa_required', challengeId, totpEnabled: !!user.totpEnabledAt, hasPasskey })
    }

    if (isAdmin(user.role) && user.totpSetupRequired) {
      const setup = await startTotpSetup(user)
      return c.json({ status: 'totp_setup_required', ...setup })
    }

    return c.json(await issueSession(c, webauthnManager, portalUserToAdmin(user)))
  })

  app.post('/api/auth/local/mfa/verify', async (c) => {
    const { challengeId, code } = await readJson<{ challengeId: string; code: string }>(c)
    if (!challengeId || !code) return c.json({ status: 'failure', message: 'invalid request' }, 400)

    const userId = await redis.get(keyMfa(challengeId))
    if (!userId) return c.json({ status: 'failure', message: 'challenge expired' }, 401)
    const user = await store.findById(userId)
    if (!user || !user.totpSecretEnc) return c.json({ status: 'failure', message: 'invalid challenge' }, 401)

    if (!await verifyCurrentFactor(user, code)) {
      authFailuresTotal.inc({ type: 'local_mfa' })
      return c.json({ status: 'failure', message: 'invalid code' }, 401)
    }

    await redis.del(keyMfa(challengeId))
    return c.json(await issueSession(c, webauthnManager, portalUserToAdmin(user)))
  })

  // Passkey as an alternative second factor, using the same pre-session
  // challengeId as the TOTP path above — the WebAuthn ceremony itself still
  // needs the browser's own challenge/response round trip via webauthnManager.
  app.post('/api/auth/local/mfa/passkey/options', async (c) => {
    const { challengeId } = await readJson<{ challengeId: string }>(c)
    if (!challengeId) return c.json({ status: 'failure', message: 'invalid request' }, 400)
    const userId = await redis.get(keyMfa(challengeId))
    if (!userId) return c.json({ status: 'failure', message: 'challenge expired' }, 401)
    try {
      const options = await webauthnManager.generateAuthenticationOptions(userId)
      return c.json(options)
    } catch {
      return c.json({ status: 'failure', message: 'no passkey registered' }, 400)
    }
  })

  app.post('/api/auth/local/mfa/passkey/verify', async (c) => {
    const { challengeId, response } = await readJson<{ challengeId: string; response: unknown }>(c)
    if (!challengeId || !response) return c.json({ status: 'failure', message: 'invalid request' }, 400)
    const userId = await redis.get(keyMfa(challengeId))
    if (!userId) return c.json({ status: 'failure', message: 'challenge expired' }, 401)
    const user = await store.findById(userId)
    if (!user) return c.json({ status: 'failure', message: 'invalid challenge' }, 401)

    try {
      await webauthnManager.verifyAuthentication(userId, response)
    } catch {
      authFailuresTotal.inc({ type: 'local_mfa_passkey' })
      return c.json({ status: 'failure', message: 'passkey verification failed' }, 401)
    }

    await redis.del(keyMfa(challengeId))
    return c.json(await issueSession(c, webauthnManager, portalUserToAdmin(user)))
  })

  app.post('/api/auth/local/totp/setup/verify', async (c) => {
    const { setupToken, code } = await readJson<{ setupToken: string; code: string }>(c)
    if (!setupToken || !code) return c.json({ status: 'failure', message: 'invalid request' }, 400)

    const raw = await redis.get(keySetup(setupToken))
    if (!raw) return c.json({ status: 'failure', message: 'setup expired' }, 401)
    const pending = JSON.parse(raw) as PendingTotp
    if (!verifyTotpCode(pending.secretBase32, code)) {
      return c.json({ status: 'failure', message: 'invalid code' }, 401)
    }
    const user = await store.findById(pending.userId)
    if (!user) return c.json({ status: 'failure', message: 'invalid setup' }, 401)

    const backupCodes = await finishTotpEnrollment(user, pending.secretBase32)
    await redis.del(keySetup(setupToken))
    return c.json({ ...(await issueSession(c, webauthnManager, portalUserToAdmin(user))), backupCodes })
  })

  // Self-service enrollment for accounts where TOTP isn't mandatory (the
  // seeded bootstrap admin, or any `user`-role account opting in).
  app.use('/api/auth/local/totp/enroll/*', requireSession)
  app.use('/api/auth/local/totp/status', requireSession)
  app.use('/api/auth/local/totp/backup-codes/*', requireSession)
  app.use('/api/auth/local/passkey/*', requireSession)

  // Lets a settings UI know whether the signed-in identity is a portal
  // account at all (a provider-JWT admin never has a portal_users row) and
  // whether TOTP is already enabled, without guessing from a 404.
  app.get('/api/auth/local/totp/status', async (c) => {
    const caller = c.get('mountosUser')
    const user = await store.findById(caller.id)
    return c.json({ isPortalUser: !!user, totpEnabled: !!user?.totpEnabledAt })
  })

  app.post('/api/auth/local/totp/backup-codes/regenerate', async (c) => {
    const caller = c.get('mountosUser')
    const user = await store.findById(caller.id)
    if (!user) return c.json({ status: 'failure', message: 'not found' }, 404)
    if (!user.totpEnabledAt || !user.totpSecretEnc) {
      return c.json({ status: 'failure', message: 'enable two-factor authentication first' }, 400)
    }
    const { currentCode } = await readJson<{ currentCode: string }>(c)
    if (!await verifyCurrentFactor(user, currentCode)) {
      return c.json({ status: 'failure', message: 'current authenticator or backup code required' }, 403)
    }
    const backupCodes = generateBackupCodes()
    await store.replaceBackupCodes(user.id, backupCodes.map((code) => hashBackupCode(code, cfg.passwordPepper)))
    return c.json({ status: 'ok', backupCodes })
  })

  // Removes a WebAuthn credential using the account's TOTP/backup-code
  // factor as proof, instead of the generic cross-cutting WebAuthn step-up
  // (server/stepup.ts) that DELETE /api/webauthn/credentials/:id sits behind
  // by default. That step-up is a chicken-and-egg dead end for exactly the
  // case this exists to cover: a passkey that's no longer reachable from the
  // current device/browser (lost phone, broken sync) can never re-authenticate
  // to authorize its own removal. TOTP is portal admins' independently
  // verifiable factor, so it works as proof here even when the passkey itself
  // doesn't.
  app.post('/api/auth/local/passkey/delete', async (c) => {
    const caller = c.get('mountosUser')
    const user = await store.findById(caller.id)
    if (!user) return c.json({ status: 'failure', message: 'not found' }, 404)
    const { credentialId, code } = await readJson<{ credentialId: string; code: string }>(c)
    if (!credentialId) return c.json({ status: 'failure', message: 'invalid request' }, 400)
    if (!await verifyCurrentFactor(user, code)) {
      return c.json({ status: 'failure', message: 'current authenticator or backup code required' }, 403)
    }
    const deleted = await webauthnManager.deleteCredential(user.id, credentialId)
    if (!deleted) return c.json({ status: 'failure', message: 'credential not found' }, 404)
    return c.json({ status: 'ok' })
  })

  // Starting a new enrollment when one is already active is a 2FA takeover
  // primitive for anyone riding a hijacked session/cookie (they'd never need
  // the victim's real authenticator): rotation requires proving the CURRENT
  // factor first, exactly like changing a password requires the old one.
  app.post('/api/auth/local/totp/enroll/start', async (c) => {
    const caller = c.get('mountosUser')
    const user = await store.findById(caller.id)
    if (!user) return c.json({ status: 'failure', message: 'not found' }, 404)

    if (user.totpEnabledAt) {
      const { currentCode } = await readJson<{ currentCode: string }>(c)
      if (!await verifyCurrentFactor(user, currentCode)) {
        return c.json({ status: 'failure', message: 'current authenticator or backup code required to rotate 2FA' }, 403)
      }
    }

    const secretBase32 = generateTotpSecret()
    const pending: PendingTotp = { userId: user.id, secretBase32 }
    await redis.set(keyEnroll(user.id), JSON.stringify(pending), 'EX', TOTP_SETUP_TTL)
    return c.json({ secretBase32, otpauthUri: totpEnrollUri(secretBase32, user.email) })
  })

  app.post('/api/auth/local/totp/enroll/verify', async (c) => {
    const caller = c.get('mountosUser')
    const { code } = await readJson<{ code: string }>(c)
    if (!code) return c.json({ status: 'failure', message: 'invalid request' }, 400)
    const raw = await redis.get(keyEnroll(caller.id))
    if (!raw) return c.json({ status: 'failure', message: 'enrollment expired' }, 401)
    const pending = JSON.parse(raw) as PendingTotp
    if (!verifyTotpCode(pending.secretBase32, code)) {
      return c.json({ status: 'failure', message: 'invalid code' }, 401)
    }
    const user = await store.findById(caller.id)
    if (!user) return c.json({ status: 'failure', message: 'not found' }, 404)
    const wasRotation = !!user.totpEnabledAt
    const backupCodes = await finishTotpEnrollment(user, pending.secretBase32)
    await redis.del(keyEnroll(caller.id))
    // A rotation invalidates every session, including this one: the whole
    // point is to shut out anyone who rode a hijacked session to get here.
    if (wasRotation) await dashboardAuth.revokeUserSessions(user.email)
    return c.json({ status: 'ok', backupCodes })
  })

  app.post('/api/auth/local/password/forgot', async (c) => {
    const { email } = await readJson<{ email: string }>(c)
    const user = email ? await store.findByEmail(email.trim().toLowerCase()) : null
    if (user && user.status === PORTAL_STATUS.active) {
      const lastIssuedAt = await store.lastTokenIssuedAt(user.id, TOKEN_KIND.resetPassword)
      const withinCooldown = lastIssuedAt && (Date.now() - lastIssuedAt.getTime()) / 1000 < RESEND_COOLDOWN_SECONDS
      // A cooldown hit still returns 200 below, same as an unknown address —
      // a 429 here would itself reveal that the account exists.
      if (!withinCooldown) {
        const { token, hash } = generateOpaqueToken()
        await store.createToken(user.id, TOKEN_KIND.resetPassword, hash, RESET_TTL)
        await trySendEmail(() => sendPasswordResetEmail(user.email, user.name, `${cfg.appUrl}/password/reset?token=${token}`))
      }
    }
    // Always 200 — do not reveal whether the address has an account.
    return c.json({ status: 'ok' })
  })

  app.post('/api/auth/local/password/reset', async (c) => {
    const { token, newPassword } = await readJson<{ token: string; newPassword: string }>(c)
    if (!token || !newPassword) return c.json({ status: 'failure', message: 'invalid request' }, 400)
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return c.json({ status: 'failure', message: `password must be at least ${MIN_PASSWORD_LENGTH} characters` }, 400)
    }
    const user = await store.consumeToken(hashOpaqueToken(token), TOKEN_KIND.resetPassword)
    if (!user) return c.json({ status: 'failure', message: 'invalid or expired token' }, 400)
    const passwordHash = await hashPassword(newPassword, cfg.passwordPepper)
    await store.setPassword(user.id, passwordHash, PASSWORD_ALGO)
    await dashboardAuth.revokeUserSessions(user.email)
    return c.json({ status: 'ok' })
  })

  app.post('/api/auth/local/invite/accept', async (c) => {
    const { token, password } = await readJson<{ token: string; password: string }>(c)
    if (!token || !password) return c.json({ status: 'failure', message: 'invalid request' }, 400)
    if (password.length < MIN_PASSWORD_LENGTH) {
      return c.json({ status: 'failure', message: `password must be at least ${MIN_PASSWORD_LENGTH} characters` }, 400)
    }
    const user = await store.consumeToken(hashOpaqueToken(token), TOKEN_KIND.invite)
    if (!user) return c.json({ status: 'failure', message: 'invalid or expired invite' }, 400)

    const passwordHash = await hashPassword(password, cfg.passwordPepper)
    const requireTotpSetup = isAdmin(user.role)
    await store.activateWithPassword(user.id, passwordHash, PASSWORD_ALGO, requireTotpSetup)

    if (requireTotpSetup) {
      const setup = await startTotpSetup(user)
      return c.json({ status: 'totp_setup_required', ...setup })
    }
    return c.json(await issueSession(c, webauthnManager, portalUserToAdmin(user)))
  })

  app.use('/api/auth/local/invite/*', requireSession)
  app.use('/api/auth/local/admin/*', requireSession)

  // Lets a per-user page render "Send invite" vs "Resend invite" vs
  // "Invite active" without a dedicated portal-users listing UI.
  app.get('/api/auth/local/invite/status', async (c) => {
    const caller = c.get('mountosUser')
    if (!isAdmin(caller.role)) return c.json({ status: 'failure', message: 'forbidden' }, 403)
    const email = c.req.query('email')?.trim().toLowerCase()
    if (!email) return c.json({ status: 'failure', message: 'email required' }, 400)
    const user = await store.findByEmail(email)
    return c.json({
      inviteStatus: user?.status ?? 'none',
      role: user?.role,
      emailVerified: !!user?.emailVerifiedAt,
      totpEnabled: !!user?.totpEnabledAt,
    })
  })

  app.post('/api/auth/local/invite/admin', async (c) => {
    const caller = c.get('mountosUser')
    if (caller.role !== ROLE.superadmin) return c.json({ status: 'failure', message: 'forbidden' }, 403)
    const { email, name, role } = await readJson<{ email: string; name: string; role: string }>(c)
    if (!email || !name || !role || !isAdmin(role)) return c.json({ status: 'failure', message: 'invalid request' }, 400)

    const user = await store.createInvite({ email: email.trim().toLowerCase(), name: name.trim(), role })
    const { token, hash } = generateOpaqueToken()
    await store.createToken(user.id, TOKEN_KIND.invite, hash, INVITE_TTL)
    const emailSent = await trySendEmail(() => sendInviteEmail(user.email, user.name, `${cfg.appUrl}/invite/accept?token=${token}`))
    return c.json({ status: 'ok', id: user.id, emailSent })
  })

  // Grants (or changes) admin-role access on an EXISTING portal record. It is
  // not an invite: the record must already exist (created via invite/admin,
  // invite/user, or seed-admin), and this never creates one.
  app.post('/api/auth/local/admin/role', async (c) => {
    const caller = c.get('mountosUser')
    if (caller.role !== ROLE.superadmin) return c.json({ status: 'failure', message: 'forbidden' }, 403)
    const { email, role } = await readJson<{ email: string; role: string }>(c)
    if (!email || !role || !isAdmin(role)) return c.json({ status: 'failure', message: 'invalid request' }, 400)

    const user = await store.findByEmail(email.trim().toLowerCase())
    if (!user) return c.json({ status: 'failure', message: 'no portal account exists for this email yet. Invite them first.' }, 404)

    await store.switchToAdminRole(user.id, role)
    return c.json({ status: 'ok' })
  })

  app.post('/api/auth/local/invite/user', async (c) => {
    const caller = c.get('mountosUser')
    if (!isAdmin(caller.role)) return c.json({ status: 'failure', message: 'forbidden' }, 403)
    const { email, name, accountId, appservUserId } = await readJson<{ email: string; name: string; accountId: number; appservUserId: number }>(c)
    if (!email || !name || accountId == null || appservUserId == null) {
      return c.json({ status: 'failure', message: 'invalid request' }, 400)
    }

    const user = await store.createInvite({ email: email.trim().toLowerCase(), name: name.trim(), role: ROLE.user, accountId, appservUserId })
    const { token, hash } = generateOpaqueToken()
    await store.createToken(user.id, TOKEN_KIND.invite, hash, INVITE_TTL)
    const emailSent = await trySendEmail(() => sendInviteEmail(user.email, user.name, `${cfg.appUrl}/invite/accept?token=${token}`))
    return c.json({ status: 'ok', id: user.id, emailSent })
  })

  app.post('/api/auth/local/invite/resend', async (c) => {
    const caller = c.get('mountosUser')
    if (!isAdmin(caller.role)) return c.json({ status: 'failure', message: 'forbidden' }, 403)
    const { email } = await readJson<{ email: string }>(c)
    const user = email ? await store.findByEmail(email.trim().toLowerCase()) : null
    if (!user || user.status !== PORTAL_STATUS.invited) return c.json({ status: 'failure', message: 'no pending invite' }, 400)

    const lastIssuedAt = await store.lastTokenIssuedAt(user.id, TOKEN_KIND.invite)
    const secondsSinceLast = lastIssuedAt ? (Date.now() - lastIssuedAt.getTime()) / 1000 : Infinity
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      const retryAfterSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)
      return c.json({ status: 'failure', message: `Please wait ${retryAfterSeconds}s before resending`, retryAfterSeconds }, 429)
    }

    const { token, hash } = generateOpaqueToken()
    await store.createToken(user.id, TOKEN_KIND.invite, hash, INVITE_TTL)
    const emailSent = await trySendEmail(() => sendInviteEmail(user.email, user.name, `${cfg.appUrl}/invite/accept?token=${token}`))
    return c.json({ status: 'ok', emailSent })
  })

  return app
}
