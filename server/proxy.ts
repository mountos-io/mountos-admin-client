import { Hono } from 'hono'
import { TokenSigner, signDashboardUser } from '@mountos-io/admin-sdk'
import type { DashboardUser } from '@mountos-io/admin-sdk'
import type { AdminUser } from './types'

const APPSERV_URL = process.env.MOUNTOS_APPSERV_URL ?? 'http://localhost:8080'
const PRIVATE_KEY = process.env.MOUNTOS_SDK_SIGNING_KEY!
const keyBytes = Buffer.from(PRIVATE_KEY, 'base64')
if (PRIVATE_KEY.length !== 44 || keyBytes.length !== 32) {
  throw new Error(`MOUNTOS_SDK_SIGNING_KEY: expected 44-char base64 (32 bytes), got ${PRIVATE_KEY.length} chars / ${keyBytes.length} bytes`)
}

const signer = new TokenSigner(PRIVATE_KEY)

export const proxy = new Hono()

proxy.all('/api/v1/*', async (c) => {
  const upstreamPath = c.req.path
  const url = new URL(c.req.url)

  const method = c.req.method
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await c.req.text()

  try {
    const token = await signer.getToken()
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    }
    if (body) headers['Content-Type'] = 'application/json'

    const adminUser = c.get('mountosUser') as AdminUser | undefined
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
