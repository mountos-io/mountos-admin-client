import { Hono } from 'hono'
import { MountOSAdmin } from '@mountos-app/admin-sdk'

const APPSERV_URL = process.env.MOUNTOS_APPSERV_URL ?? 'http://localhost:8080'
const PRIVATE_KEY = process.env.MOUNTOS_PRIVATE_KEY ?? ''

if (!PRIVATE_KEY) {
  console.warn('MOUNTOS_PRIVATE_KEY not set — proxy requests will fail')
}

// SDK instance for JWT signing; we use its request method to forward
// For raw proxying we create a TokenSigner-equivalent via the SDK
const sdk = new MountOSAdmin({ baseUrl: APPSERV_URL, privateKey: PRIVATE_KEY })

export const proxy = new Hono()

proxy.all('/api/proxy/v1/*', async (c) => {
  // SDK doesn't expose TokenSigner/signRequest, so we use sdk.request()
  // which parses JSON internally. A raw signed-fetch would be better.
  const upstreamPath = c.req.path.replace('/api/proxy', '')
  const url = new URL(upstreamPath, APPSERV_URL)
  url.search = new URL(c.req.url).search

  const method = c.req.method
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await c.req.text()

  try {
    const headers: Record<string, string> = {
      'Content-Type': c.req.header('content-type') ?? 'application/json',
    }

    const adminUser = c.get('mountosUser') as { id: string; name: string; email?: string } | undefined
    if (adminUser) {
      headers['X-MountOS-Admin-User'] = btoa(JSON.stringify(adminUser))
    }

    const data = await sdk.request(method, upstreamPath + url.search, body ? JSON.parse(body) : undefined)

    return c.json({ status: 'success', message: 'ok', data })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; errorCode?: number }
    return c.json(
      { status: 'failure', message: e.message ?? 'proxy error', errorCode: e.errorCode },
      { status: e.status ?? 502 },
    )
  }
})
