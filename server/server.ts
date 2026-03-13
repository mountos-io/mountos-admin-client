import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { secureHeaders } from 'hono/secure-headers'
import { csrf } from 'hono/csrf'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { bootstrap } from '../src/vendor/server/bootstrap'
import { vendorCsrfConfig } from '../src/vendor/server/config'
import { dashboardAuth } from './auth'
import { auth } from './middleware'
import { proxy } from './proxy'

await bootstrap()

const required = ['VENDOR2DASHBOARD_VERIFICATION_KEY', 'DASHBOARD_SIGNING_KEY', 'DASHBOARD_VERIFICATION_KEY', 'MOUNTOS_APPSERV_URL', 'MOUNTOS_SDK_SIGNING_KEY']
const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env: ${missing.join(', ')}`)
  process.exit(1)
}

await dashboardAuth.init()

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

const app = new Hono()

app.use(secureHeaders())

const csrfCheck = csrf(vendorCsrfConfig.origin ? { origin: vendorCsrfConfig.origin } : undefined)
app.use('/api/*', async (c, next) => {
  if (vendorCsrfConfig.whitelist?.some((p) => c.req.path.startsWith(p))) return next()
  return csrfCheck(c, next)
})

app.get('/health', (c) => c.json({ status: 'ok' }))

// Auth token exchange & session — before auth middleware
app.get('/api/me', async (c) => {
  const vendorToken = c.req.query('token')
  if (vendorToken) {
    try {
      const user = await dashboardAuth.validateVendorToken(vendorToken)
      const [token, refreshToken] = await Promise.all([
        dashboardAuth.signSessionToken(user),
        dashboardAuth.signRefreshToken(user),
      ])
      setTokenCookies(c, token, refreshToken)
      return c.json({ user, token, refreshToken })
    } catch {
      return c.json({ status: 'failure', message: 'invalid vendor token' }, 401)
    }
  }

  const authHeader = c.req.header('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  if (bearer) {
    try {
      const user = await dashboardAuth.verifySessionToken(bearer)
      return c.json({ user })
    } catch {
      return c.json({ status: 'failure', message: 'invalid session token' }, 401)
    }
  }

  // Try cookie-based session recovery
  const sessionCookie = getCookie(c, COOKIE_SESSION)
  if (sessionCookie) {
    try {
      const user = await dashboardAuth.verifySessionToken(sessionCookie)
      const refreshCookie = getCookie(c, COOKIE_REFRESH)
      return c.json({ user, token: sessionCookie, refreshToken: refreshCookie })
    } catch { /* session expired, fall through to refresh */ }
  }

  const refreshCookie = getCookie(c, COOKIE_REFRESH)
  if (refreshCookie) {
    try {
      const user = await dashboardAuth.verifyRefreshToken(refreshCookie)
      const [token, refreshToken] = await Promise.all([
        dashboardAuth.signSessionToken(user),
        dashboardAuth.signRefreshToken(user),
      ])
      setTokenCookies(c, token, refreshToken)
      return c.json({ user, token, refreshToken })
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
    const [token, newRefreshToken] = await Promise.all([
      dashboardAuth.signSessionToken(user),
      dashboardAuth.signRefreshToken(user),
    ])
    setTokenCookies(c, token, newRefreshToken)
    return c.json({ token, refreshToken: newRefreshToken })
  } catch {
    return c.json({ status: 'failure', message: 'invalid refresh token' }, 401)
  }
})

app.post('/api/auth/logout', (c) => {
  clearTokenCookies(c)
  return c.json({ status: 'ok' })
})

app.use('/api/*', auth)
app.route('/', proxy)

app.use('/*', serveStatic({ root: './build' }))
app.get('*', serveStatic({ path: './build/index.html' }))

const port = Number(process.env.PORT ?? 3001)
console.log(`Admin server listening on :${port}`)

export default {
  port,
  fetch: app.fetch,
}
