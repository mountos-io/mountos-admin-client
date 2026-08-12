import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { TokenSigner, signDashboardUser } from '@mountos-io/admin-sdk'
import type { DashboardUser } from '@mountos-io/admin-sdk'
import type { AdminUser } from './types'
import { ROLE } from './types'

const APPSERV_URL = process.env.MOUNTOS_APPSERV_URL ?? 'http://localhost:8080'
const PRIVATE_KEY = process.env.MOUNTOS_SDK_SIGNING_KEY!
// TokenSigner's own ed25519SeedFrom() already accepts either the 32-byte
// seed (44-char base64) or the 64-byte seed||pubkey form (88-char base64,
// what mountos-servers' keygen and every other service in this system
// produce) and derives the seed itself — this pre-check was stricter than
// the SDK it's guarding, rejecting a form the SDK already supports. Keep a
// check, but match the SDK's own accepted lengths instead of a single one.
const keyBytes = Buffer.from(PRIVATE_KEY, 'base64')
if (keyBytes.length !== 32 && keyBytes.length !== 64) {
  throw new Error(`MOUNTOS_SDK_SIGNING_KEY: expected a 32-byte or 64-byte Ed25519 private key (base64), got ${keyBytes.length} bytes`)
}

const signer = new TokenSigner(PRIVATE_KEY)

// Dedicated HMAC secret for the X-MountOS-Dashboard-User header. Must match the
// appserv DASHBOARD_USER_HMAC_KEY; it is a separate secret from the admin
// signing key (never the public verification key).
const DASHBOARD_USER_HMAC_KEY = process.env.DASHBOARD_USER_HMAC_KEY
if (!DASHBOARD_USER_HMAC_KEY) {
  throw new Error('DASHBOARD_USER_HMAC_KEY is required to sign the X-MountOS-Dashboard-User header')
}

// Volume fields a regular user is not allowed to set on create/edit. Rejected
// pre-proxy so a tampered client can't sneak past the UI gates. Appserv
// enforces the same constraints based on the signed DashboardUser role.
const USER_ROLE_FORBIDDEN_VOLUME_FIELDS = ['gracePeriod', 'restrictByLiveVolume', 'quotaLimit'] as const
const VOLUME_EDIT_PATH = /^\/api\/v1\/volumes\/\d+\/edit$/
const VOLUME_QUOTA_PATH = /^\/api\/v1\/volumes\/\d+\/quota$/
const VOLUME_CREATE_PATH = '/api/v1/volumes/create'
const VOLUME_API_KEYS_GENERATE_PATH = /^\/api\/v1\/volumes\/\d+\/api-keys\/generate$/

// Endpoints where userId must be enforced for user role via query param injection.
// The proxy overwrites the userId query param with the value from the session token
// regardless of what the client sent, so a tampered client cannot hijack another user's data.
// Only list/aggregate endpoints are included; get-by-ID paths have no userId query param.
const USER_SCOPED_QUERY_PATHS: RegExp[] = [
  /^\/api\/v1\/client-sessions\/(list|summary)$/,
]

const VOLUME_API_KEYS_REVOKE_BY_USER_PATH = /^\/api\/v1\/volumes\/(\d+)\/api-keys\/revoke-by-user$/
const CLIENT_SESSION_GET_PATH = /^\/api\/v1\/client-sessions\/(\d+)$/

// Self-service token generation: the frontend never sends a userId;
// proxy injects it from the logged-in session before forwarding to appserv.
// Appserv enforces that the user can only generate keys for their own user,
// so blindly trusting the body would let a tampered client mint keys for
// someone else. Overwrite, don't merge.
function injectGenerateApiKeysUserId(body: string | undefined, adminUser: AdminUser | undefined): { body: string; error?: undefined } | { body?: undefined; error: string } {
  if (!adminUser?.userId) return { error: 'no linked user id on this account; cannot generate API token' }
  let parsed: Record<string, unknown> = {}
  if (body) {
    try { parsed = JSON.parse(body) as Record<string, unknown> } catch { parsed = {} }
  }
  parsed.userId = adminUser.userId
  return { body: JSON.stringify(parsed) }
}

function rejectUserRoleVolumeFields(path: string, method: string, body: string | undefined): string | null {
  if (!body) return null
  const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH'
  if (!isWrite) return null
  if (path !== VOLUME_CREATE_PATH && !VOLUME_EDIT_PATH.test(path) && !VOLUME_QUOTA_PATH.test(path)) return null
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { return null }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  for (const field of USER_ROLE_FORBIDDEN_VOLUME_FIELDS) {
    if (obj[field] !== undefined) return field
  }
  return null
}

export const proxy = new Hono()

proxy.all('/api/v1/*', async (c) => {
  const upstreamPath = c.req.path
  const url = new URL(c.req.url)

  const method = c.req.method
  let body = ['GET', 'HEAD'].includes(method) ? undefined : await c.req.text()

  const adminUser = c.get('mountosUser') as AdminUser | undefined
  if (adminUser?.role === ROLE.user) {
    const blocked = rejectUserRoleVolumeFields(upstreamPath, method, body)
    if (blocked) {
      return c.json({ status: 'failure', message: `field not permitted for this role: ${blocked}` }, 403)
    }
  }

  if (method === 'POST' && VOLUME_API_KEYS_GENERATE_PATH.test(upstreamPath)) {
    const r = injectGenerateApiKeysUserId(body, adminUser)
    if (r.error) {
      return c.json({ status: 'failure', message: r.error }, 400)
    }
    body = r.body
  }

  if (adminUser?.role === ROLE.user && method === 'POST' && VOLUME_API_KEYS_REVOKE_BY_USER_PATH.test(upstreamPath)) {
    const r = injectGenerateApiKeysUserId(body, adminUser)
    if (r.error) {
      return c.json({ status: 'failure', message: r.error }, 400)
    }
    body = r.body
  }

  // For user role, enforce userId from the session token on scoped list/aggregate endpoints;
  // overwrites whatever the client sent so a tampered client cannot read another user's data.
  if (adminUser?.role === ROLE.user && adminUser.userId != null && USER_SCOPED_QUERY_PATHS.some(p => p.test(upstreamPath))) {
    url.searchParams.set('userId', String(adminUser.userId))
  }

  try {
    const token = await signer.getToken()
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    }
    if (body) headers['Content-Type'] = 'application/json'

    if (adminUser) {
      headers['X-MountOS-Dashboard-User'] = await signDashboardUser(
        adminUser as DashboardUser, DASHBOARD_USER_HMAC_KEY
      )
    }

    const res = await fetch(`${APPSERV_URL}${upstreamPath}${url.search}`, { method, headers, body })

    // appserv always replies JSON; a non-JSON body means an infra-level error
    // (gateway 502/504 HTML, plaintext). Detect JSON by parsing the body, not by
    // content-type: the h2 dispatcher can drop response headers, which would
    // otherwise misflag every reply as a non-JSON error.
    const text = await res.text()
    let json: { status?: string; message?: string; data?: unknown; errorCode?: number } | undefined
    try { json = JSON.parse(text) } catch { json = undefined }

    if (!json || typeof json !== 'object') {
      return c.json(
        { status: 'failure', message: text.trim().slice(0, 300) || `upstream returned ${res.status} with no body` },
        (res.status === 401 ? 502 : res.status) as ContentfulStatusCode,
      )
    }

    if (json.status !== 'success') {
      return c.json(
        { status: 'failure', message: json.message ?? 'proxy error', errorCode: json.errorCode },
        (res.status === 401 ? 502 : res.status) as ContentfulStatusCode,
      )
    }

    // Server-side ownership check for user role get-by-ID: verify the returned
    // session belongs to the caller. Client-side checks are bypassable via direct
    // proxy calls, so this enforcement must live here.
    if (
      adminUser?.role === ROLE.user &&
      adminUser.userId != null &&
      method === 'GET' &&
      CLIENT_SESSION_GET_PATH.test(upstreamPath)
    ) {
      const session = json.data as { user?: { id?: number } } | undefined
      if (session?.user?.id !== adminUser.userId) {
        return c.json({ status: 'failure', message: 'forbidden' }, 403)
      }
    }

    return c.json({ status: 'success', message: 'ok', data: json.data })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; errorCode?: number }
    const upstream = e.status ?? 502
    return c.json(
      { status: 'failure', message: e.message ?? 'proxy error', errorCode: e.errorCode },
      (upstream === 401 ? 502 : upstream) as ContentfulStatusCode,
    )
  }
})
