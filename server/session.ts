import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { ROLE, type AdminUser } from './types'
import { dashboardAuth } from './auth'
import type { WebAuthnManager } from './webauthn'

export const COOKIE_SESSION = 'mountos_session'
export const COOKIE_REFRESH = 'mountos_refresh'

function cookieOpts() {
  return { httpOnly: true, sameSite: 'Strict' as const, path: '/', secure: process.env.NODE_ENV !== 'development' }
}

export function setTokenCookies(c: Context, token: string, refreshToken: string) {
  const opts = cookieOpts()
  setCookie(c, COOKIE_SESSION, token, { ...opts, maxAge: dashboardAuth.sessionTTL })
  setCookie(c, COOKIE_REFRESH, refreshToken, { ...opts, maxAge: dashboardAuth.refreshTTL })
}

export function clearTokenCookies(c: Context) {
  const opts = cookieOpts()
  deleteCookie(c, COOKIE_SESSION, opts)
  deleteCookie(c, COOKIE_REFRESH, opts)
}

export { getCookie }

export async function webauthnState(webauthnManager: WebAuthnManager, userId: string) {
  const creds = await webauthnManager.listCredentials(userId)
  return { enrolled: creds.length > 0, credentialCount: creds.length }
}

export async function enrichUserResponse(webauthnManager: WebAuthnManager, user: AdminUser, extra: Record<string, unknown> = {}) {
  const capabilities = dashboardAuth.resolveCapabilities(user.role)
  const webauthn = await webauthnState(webauthnManager, user.id)
  const result: Record<string, unknown> = { user, capabilities, webauthn, ...extra }
  if (user.role === ROLE.user && user.accountId != null) {
    result.account = await dashboardAuth.fetchAccountForUser(user.accountId).catch(() => undefined)
  }
  return result
}

// Issues session+refresh tokens and sets cookies — the single path any login
// method (provider exchange, local password+TOTP) uses to establish a session.
export async function issueSession(c: Context, webauthnManager: WebAuthnManager, user: AdminUser, extra: Record<string, unknown> = {}) {
  const [token, refreshToken] = await Promise.all([
    dashboardAuth.signSessionToken(user),
    dashboardAuth.signRefreshToken(user),
  ])
  setTokenCookies(c, token, refreshToken)
  return enrichUserResponse(webauthnManager, user, { token, refreshToken, ...extra })
}
