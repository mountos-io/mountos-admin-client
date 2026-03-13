import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { secureHeaders } from 'hono/secure-headers'
import { csrf } from 'hono/csrf'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { bootstrap } from '../src/vendor/server/bootstrap'
import { vendorCsrfConfig, vendorCspConfig, vendorStepUpRules, vendorWebAuthnConfig } from '../src/vendor/server/config'
import { vendorAuthzMiddleware } from '../src/vendor/server/middleware'
import type { CsrfConfig, ContentSecurityPolicy, WebAuthnConfig } from './types'
import { dashboardAuth } from './auth'
import { auth } from './middleware'
import { proxy } from './proxy'
import { WebAuthnManager } from './webauthn'
import { createStepUpMiddleware } from './stepup'

await bootstrap()

const required = ['VENDOR2DASHBOARD_VERIFICATION_KEY', 'DASHBOARD_SIGNING_KEY', 'DASHBOARD_VERIFICATION_KEY', 'MOUNTOS_APPSERV_URL', 'MOUNTOS_SDK_SIGNING_KEY', 'REDIS_URL']
const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env: ${missing.join(', ')}`)
  process.exit(1)
}

await dashboardAuth.init()

const webauthnConfig: WebAuthnConfig = {
  rpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
  rpName: process.env.WEBAUTHN_RP_NAME ?? 'mountOS Dashboard',
  origin: process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:5173',
  ...vendorWebAuthnConfig,
}
const webauthnManager = new WebAuthnManager(dashboardAuth.redisClient, webauthnConfig)
const stepUpMiddleware = createStepUpMiddleware(webauthnManager, vendorStepUpRules)

const COOKIE_SESSION = 'mountos_session'
const COOKIE_REFRESH = 'mountos_refresh'

function setTokenCookies(c: Context, token: string, refreshToken: string) {
  const opts = { httpOnly: true, sameSite: 'Strict' as const, path: '/', secure: process.env.NODE_ENV !== 'development' }
  setCookie(c, COOKIE_SESSION, token, { ...opts, maxAge: dashboardAuth.sessionTTL })
  setCookie(c, COOKIE_REFRESH, refreshToken, { ...opts, maxAge: dashboardAuth.refreshTTL })
}

function clearTokenCookies(c: Context) {
  const opts = { httpOnly: true, sameSite: 'Strict' as const, path: '/', secure: process.env.NODE_ENV !== 'development' }
  deleteCookie(c, COOKIE_SESSION, opts)
  deleteCookie(c, COOKIE_REFRESH, opts)
}

const cspDefaults: ContentSecurityPolicy = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
}
const cspConfig = { ...cspDefaults, ...vendorCspConfig }

const csrfDefaults: CsrfConfig = { whitelist: [] }
const csrfConfig = { ...csrfDefaults, ...vendorCsrfConfig }

const app = new Hono()

app.use(secureHeaders({ contentSecurityPolicy: cspConfig }))

const csrfCheck = csrf(csrfConfig.origin ? { origin: csrfConfig.origin } : undefined)
app.use('/api/*', async (c, next) => {
  if (csrfConfig.whitelist.some((p) => c.req.path.startsWith(p))) return next()
  return csrfCheck(c, next)
})

app.get('/health', (c) => c.json({ status: 'ok' }))

// Vendor token exchange — token in body, not URL
app.post('/api/auth/exchange', async (c) => {
  try {
    const { token: vendorToken } = await c.req.json<{ token: string }>()
    const user = await dashboardAuth.validateVendorToken(vendorToken)
    const capabilities = dashboardAuth.resolveCapabilities(user.role)
    const [token, refreshToken] = await Promise.all([
      dashboardAuth.signSessionToken(user),
      dashboardAuth.signRefreshToken(user),
    ])
    setTokenCookies(c, token, refreshToken)
    return c.json({ user, token, refreshToken, capabilities })
  } catch {
    return c.json({ status: 'failure', message: 'invalid vendor token' }, 401)
  }
})

async function webauthnState(userId: string) {
  const creds = await webauthnManager.listCredentials(userId)
  return { enrolled: creds.length > 0, credentialCount: creds.length }
}

// Session verification & cookie recovery — before auth middleware
app.get('/api/me', async (c) => {
  const authHeader = c.req.header('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  if (bearer) {
    try {
      const user = await dashboardAuth.verifySessionToken(bearer)
      const capabilities = dashboardAuth.resolveCapabilities(user.role)
      const webauthn = await webauthnState(user.id)
      return c.json({ user, capabilities, webauthn })
    } catch {
      return c.json({ status: 'failure', message: 'invalid session token' }, 401)
    }
  }

  // Try cookie-based session recovery
  const sessionCookie = getCookie(c, COOKIE_SESSION)
  if (sessionCookie) {
    try {
      const user = await dashboardAuth.verifySessionToken(sessionCookie)
      const capabilities = dashboardAuth.resolveCapabilities(user.role)
      const refreshCookie = getCookie(c, COOKIE_REFRESH)
      const webauthn = await webauthnState(user.id)
      return c.json({ user, token: sessionCookie, refreshToken: refreshCookie, capabilities, webauthn })
    } catch { /* session expired, fall through to refresh */ }
  }

  const refreshCookie = getCookie(c, COOKIE_REFRESH)
  if (refreshCookie) {
    try {
      const user = await dashboardAuth.verifyRefreshToken(refreshCookie)
      const capabilities = dashboardAuth.resolveCapabilities(user.role)
      const [token, refreshToken] = await Promise.all([
        dashboardAuth.signSessionToken(user),
        dashboardAuth.signRefreshToken(user),
      ])
      setTokenCookies(c, token, refreshToken)
      const webauthn = await webauthnState(user.id)
      return c.json({ user, token, refreshToken, capabilities, webauthn })
    } catch {
      clearTokenCookies(c)
    }
  }

  return c.json({ status: 'failure', message: 'unauthorized' }, 401)
})

app.post('/api/auth/refresh', async (c) => {
  try {
    const { refreshToken } = await c.req.json<{ refreshToken: string }>()
    const user = await dashboardAuth.verifyRefreshToken(refreshToken)
    const capabilities = dashboardAuth.resolveCapabilities(user.role)
    const [token, newRefreshToken] = await Promise.all([
      dashboardAuth.signSessionToken(user),
      dashboardAuth.signRefreshToken(user),
    ])
    setTokenCookies(c, token, newRefreshToken)
    return c.json({ token, refreshToken: newRefreshToken, capabilities })
  } catch {
    return c.json({ status: 'failure', message: 'invalid refresh token' }, 401)
  }
})

app.post('/api/auth/logout', async (c) => {
  const refreshCookie = getCookie(c, COOKIE_REFRESH)
  if (refreshCookie) await dashboardAuth.revokeRefreshToken(refreshCookie)
  clearTokenCookies(c)
  return c.json({ status: 'ok' })
})

app.use('/api/*', auth)

// WebAuthn endpoints (after auth)
app.post('/api/webauthn/register/options', async (c) => {
  const user = c.get('mountosUser')
  const existing = await webauthnManager.listCredentials(user.id)
  const options = await webauthnManager.generateRegistrationOptions(user.id, user.name, existing)
  return c.json(options)
})

app.post('/api/webauthn/register/verify', async (c) => {
  try {
    const { response, label } = await c.req.json()
    const user = c.get('mountosUser')
    const cred = await webauthnManager.verifyRegistration(user.id, response, label || 'Security Key')
    return c.json(cred)
  } catch (e: unknown) {
    return c.json({ status: 'failure', message: (e as Error).message }, 400)
  }
})

app.post('/api/webauthn/authenticate/options', async (c) => {
  const user = c.get('mountosUser')
  const options = await webauthnManager.generateAuthenticationOptions(user.id)
  return c.json(options)
})

app.post('/api/webauthn/authenticate/verify', async (c) => {
  try {
    const { response } = await c.req.json()
    const user = c.get('mountosUser')
    const stepUpToken = await webauthnManager.verifyAuthentication(user.id, response)
    return c.json({ stepUpToken })
  } catch (e: unknown) {
    return c.json({ status: 'failure', message: (e as Error).message }, 400)
  }
})

app.get('/api/webauthn/credentials', async (c) => {
  const user = c.get('mountosUser')
  const creds = await webauthnManager.listCredentials(user.id)
  return c.json(creds.map(({ publicKey: _, ...c }) => c))
})

app.delete('/api/webauthn/credentials/:id', async (c) => {
  const user = c.get('mountosUser')
  const ok = await webauthnManager.deleteCredential(user.id, c.req.param('id'))
  return ok ? c.json({ status: 'ok' }) : c.json({ status: 'not_found' }, 404)
})

app.patch('/api/webauthn/credentials/:id', async (c) => {
  try {
    const { label } = await c.req.json()
    const user = c.get('mountosUser')
    await webauthnManager.renameCredential(user.id, c.req.param('id'), label)
    return c.json({ status: 'ok' })
  } catch (e: unknown) {
    return c.json({ status: 'failure', message: (e as Error).message }, 400)
  }
})

app.use('/api/*', stepUpMiddleware)
if (vendorAuthzMiddleware) app.use('/api/*', vendorAuthzMiddleware)
app.route('/', proxy)

app.use('/*', serveStatic({ root: './build' }))
app.get('*', serveStatic({ path: './build/index.html' }))

const port = Number(process.env.PORT ?? 3001)
console.log(`Admin server listening on :${port}`)

export default {
  port,
  fetch: app.fetch,
}
