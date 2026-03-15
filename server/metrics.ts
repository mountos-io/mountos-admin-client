import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client'
import type { MiddlewareHandler } from 'hono'

export const registry = new Registry()

collectDefaultMetrics({ register: registry, prefix: 'mountos_admin_' })

export const httpRequestsTotal = new Counter({
  name: 'mountos_admin_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'] as const,
  registers: [registry],
})

export const httpRequestDuration = new Histogram({
  name: 'mountos_admin_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
})

export const authFailuresTotal = new Counter({
  name: 'mountos_admin_auth_failures_total',
  help: 'Total authentication failures',
  labelNames: ['type'] as const,
  registers: [registry],
})

export const rateLimitHitsTotal = new Counter({
  name: 'mountos_admin_rate_limit_hits_total',
  help: 'Total rate limit rejections',
  labelNames: ['prefix'] as const,
  registers: [registry],
})

export const webauthnOpsTotal = new Counter({
  name: 'mountos_admin_webauthn_ops_total',
  help: 'Total WebAuthn operations',
  labelNames: ['op', 'result'] as const,
  registers: [registry],
})

function normalizePath(path: string): string {
  return path
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '/:id')
}

export const metricsMiddleware: MiddlewareHandler = async (c, next) => {
  const start = performance.now()
  await next()
  const duration = (performance.now() - start) / 1000
  const path = normalizePath(c.req.path)
  const status = String(c.res.status)
  httpRequestsTotal.inc({ method: c.req.method, path, status })
  httpRequestDuration.observe({ method: c.req.method, path, status }, duration)
}
