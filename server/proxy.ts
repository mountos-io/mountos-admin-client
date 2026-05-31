import { Hono } from 'hono'
import { TokenSigner, signDashboardUser } from '@mountos-io/admin-sdk'
import type { DashboardUser } from '@mountos-io/admin-sdk'
import type { AdminUser } from './types'
import { ROLE } from './types'

const APPSERV_URL = process.env.MOUNTOS_APPSERV_URL ?? 'http://localhost:8080'
const PRIVATE_KEY = process.env.MOUNTOS_SDK_SIGNING_KEY!
const keyBytes = Buffer.from(PRIVATE_KEY, 'base64')
if (PRIVATE_KEY.length !== 44 || keyBytes.length !== 32) {
  throw new Error(`MOUNTOS_SDK_SIGNING_KEY: expected 44-char base64 (32 bytes), got ${PRIVATE_KEY.length} chars / ${keyBytes.length} bytes`)
}

const signer = new TokenSigner(PRIVATE_KEY)

// Volume fields a regular user is not allowed to set on create/edit. Rejected
// pre-proxy so a tampered client can't sneak past the UI gates. Appserv
// enforces the same constraints based on the signed DashboardUser role.
const USER_ROLE_FORBIDDEN_VOLUME_FIELDS = ['gracePeriod', 'restrictByLiveVolume', 'quotaLimit'] as const
const VOLUME_EDIT_PATH = /^\/api\/v1\/volumes\/\d+\/edit$/
const VOLUME_QUOTA_PATH = /^\/api\/v1\/volumes\/\d+\/quota$/
const VOLUME_CREATE_PATH = '/api/v1/volumes/create'
const VOLUME_API_KEYS_GENERATE_PATH = /^\/api\/v1\/volumes\/\d+\/api-keys\/generate$/

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

  try {
    const token = await signer.getToken()
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    }
    if (body) headers['Content-Type'] = 'application/json'

    if (adminUser) {
      headers['X-MountOS-Dashboard-User'] = await signDashboardUser(
        adminUser as DashboardUser, PRIVATE_KEY
      )
    }

    const res = await fetch(`${APPSERV_URL}${upstreamPath}${url.search}`, { method, headers, body })
    const json = await res.json() as { status: string; message?: string; data?: unknown; errorCode?: number }

    if (json.status !== 'success') {
      return c.json(
        { status: 'failure', message: json.message ?? 'proxy error', errorCode: json.errorCode },
        { status: res.status === 401 ? 502 : res.status },
      )
    }
    return c.json({ status: 'success', message: 'ok', data: json.data })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; errorCode?: number }
    const upstream = e.status ?? 502
    return c.json(
      { status: 'failure', message: e.message ?? 'proxy error', errorCode: e.errorCode },
      { status: upstream === 401 ? 502 : upstream },
    )
  }
})
