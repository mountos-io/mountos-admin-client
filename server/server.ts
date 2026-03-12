import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { vendorAuth } from './middleware'
import { proxy } from './proxy'

const app = new Hono()

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Vendor auth middleware for proxy routes
app.use('/api/proxy/*', vendorAuth)

// Proxy routes (signed forwarding to appserv)
app.route('/', proxy)

// Static files from SvelteKit build output
app.use('/*', serveStatic({ root: './build' }))

// SPA fallback for client-side routing
app.get('*', serveStatic({ path: './build/index.html' }))

const port = Number(process.env.PORT ?? 3001)
console.log(`Admin server listening on :${port}`)

export default {
  port,
  fetch: app.fetch,
}
