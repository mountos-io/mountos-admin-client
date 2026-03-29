import type { MiddlewareHandler } from 'hono'
import type { ThrottleConfig } from './types'
import { throttleHitsTotal } from './metrics'

interface Bucket {
  tokens: number
  last: number
}

const DEFAULT_LIMIT = 25
const DEFAULT_WINDOW = 1
const SWEEP_INTERVAL = 60_000
const IDLE_TTL = 30_000
const MAX_BUCKETS = 10_000

export function createThrottle(config?: Partial<ThrottleConfig>): MiddlewareHandler {
  const limit = Math.max(1, config?.limit ?? DEFAULT_LIMIT)
  const windowMs = Math.max(100, (config?.window ?? DEFAULT_WINDOW) * 1000)
  const refillRate = limit / windowMs

  const buckets = new Map<string, Bucket>()

  const sweep = setInterval(() => {
    const cutoff = Date.now() - IDLE_TTL
    for (const [id, b] of buckets) {
      if (b.last < cutoff) buckets.delete(id)
    }
  }, SWEEP_INTERVAL)
  sweep.unref()

  return async (c, next) => {
    // auth middleware guarantees mountosUser is set on /api/*
    const user = c.get('mountosUser')
    if (!user) return next()

    if (buckets.size >= MAX_BUCKETS) buckets.clear()

    const now = Date.now()
    let bucket = buckets.get(user.id)
    if (!bucket) {
      bucket = { tokens: limit, last: now }
      buckets.set(user.id, bucket)
    }

    const elapsed = now - bucket.last
    bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillRate)
    bucket.last = now

    c.header('X-Throttle-Limit', String(limit))

    if (bucket.tokens < 1) {
      throttleHitsTotal.inc()
      c.header('X-Throttle-Remaining', '0')
      c.header('Retry-After', '1')
      return c.json({ status: 'failure', message: 'too many requests' }, 429)
    }

    bucket.tokens -= 1
    c.header('X-Throttle-Remaining', String(Math.floor(bucket.tokens)))

    return next()
  }
}
