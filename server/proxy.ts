import { Hono } from 'hono'
import { MountOSAdmin } from '@mountos-app/admin-sdk'
import type { AdminUser } from './types'

const APPSERV_URL = process.env.MOUNTOS_APPSERV_URL ?? 'http://localhost:8080'
const PRIVATE_KEY = process.env.MOUNTOS_SDK_SIGNING_KEY!
const keyBytes = Buffer.from(PRIVATE_KEY, 'base64')
if (PRIVATE_KEY.length !== 44 || keyBytes.length !== 32) {
  throw new Error(`MOUNTOS_SDK_SIGNING_KEY: expected 44-char base64 (32 bytes), got ${PRIVATE_KEY.length} chars / ${keyBytes.length} bytes`)
}

// SDK instance for JWT signing; we use its request method to forward
// For raw proxying we create a TokenSigner-equivalent via the SDK
const sdk = new MountOSAdmin({ baseUrl: APPSERV_URL, privateKey: PRIVATE_KEY })

export const proxy = new Hono()

proxy.all('/api/v1/*', async (c) => {
  const upstreamPath = c.req.path
  const url = new URL(upstreamPath, APPSERV_URL)
  url.search = new URL(c.req.url).search

  const method = c.req.method
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await c.req.text()

  try {
    const headers: Record<string, string> = {
      'Content-Type': c.req.header('content-type') ?? 'application/json',
    }

    const adminUser = c.get('mountosUser') as AdminUser | undefined
    if (adminUser) {
      headers['X-MountOS-Admin-User'] = btoa(JSON.stringify(adminUser))
    }

    const data = await sdk.request(method, upstreamPath + url.search, body ? JSON.parse(body) : undefined)

    return c.json({ status: 'success', message: 'ok', data })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; errorCode?: number }
    const upstream = e.status ?? 502
    return c.json(
      { status: 'failure', message: e.message ?? 'proxy error', errorCode: e.errorCode },
      { status: upstream === 401 ? 502 : upstream },
    )
  }
})
