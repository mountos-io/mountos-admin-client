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
  // Strip /api/proxy prefix → /api/v1/...
  const upstreamPath = c.req.path.replace('/api/proxy', '')
  const url = new URL(upstreamPath, APPSERV_URL)
  url.search = new URL(c.req.url).search

  // Sign via SDK: get a token by making a dummy call path; instead we
  // replicate the signing approach. Since MountOSAdmin doesn't expose
  // TokenSigner, we use SDK's request to proxy by forwarding the request
  // through the SDK's fetch mechanism.
  //
  // Alternative: the SDK should export TokenSigner for proxy use cases.
  // For now, we do a raw fetch with the SDK as JWT source.

  // Use SDK internal request method by calling it with a pass-through
  // Actually, the cleanest approach: create a parallel signer.
  // But since SDK doesn't export TokenSigner, we proxy by constructing
  // the upstream request and using the SDK's authorization.

  const method = c.req.method
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await c.req.text()

  try {
    // Forward as raw fetch — the SDK's request parses JSON,
    // so we replicate the auth header manually.
    // TODO: SDK should export TokenSigner or a signRequest helper.
    // For now, piggyback on sdk.request to get auth flowing.
    const headers: Record<string, string> = {
      'Content-Type': c.req.header('content-type') ?? 'application/json',
    }

    // Extract admin user from context (set by vendor middleware)
    const adminUser = c.get('mountosUser') as { id: string; name: string; email?: string } | undefined
    if (adminUser) {
      headers['X-MountOS-Admin-User'] = btoa(JSON.stringify(adminUser))
    }

    // Use sdk.request to get the response through the signed channel
    // This parses the response — for a true raw proxy, SDK needs to
    // expose a lower-level signed fetch. Using this approach for now.
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
