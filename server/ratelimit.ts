import type { MiddlewareHandler, Context } from 'hono'
import type Redis from 'ioredis'
import type { RateLimitRule } from './types'
import { rateLimitHitsTotal } from './metrics'

export interface RateLimitConfig {
  rules: RateLimitRule[]
  /** Vendor rules take priority over defaults for the same prefix */
  vendorRules?: RateLimitRule[]
}

const LUA_SLIDE = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local uid = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local count = redis.call('ZCARD', key)
if count >= limit then return {0, count, limit} end
redis.call('ZADD', key, now, uid)
redis.call('EXPIRE', key, math.ceil(window_ms / 1000) + 1)
return {1, count + 1, limit}`

let reqCounter = 0

function keyFor(prefix: string, ip: string): string {
  return `mountos:rl:${prefix}:${ip}`
}

function clientIp(c: Context): string {
  return c.req.header('x-real-ip')
    ?? c.req.header('x-forwarded-for')?.split(',').pop()?.trim()
    ?? '0.0.0.0'
}

function matchRule(rules: RateLimitRule[], path: string): RateLimitRule | undefined {
  let best: RateLimitRule | undefined
  for (const r of rules) {
    if (path.startsWith(r.prefix) && (!best || r.prefix.length > best.prefix.length)) {
      best = r
    }
  }
  return best
}

export function createRateLimiter(redis: Redis, config: RateLimitConfig): MiddlewareHandler {
  const rules = [...(config.vendorRules ?? []), ...config.rules]

  return async (c, next) => {
    const rule = matchRule(rules, c.req.path)
    if (!rule) return next()

    const ip = clientIp(c)
    const key = keyFor(rule.prefix, ip)
    const now = Date.now()
    const uid = `${now}:${++reqCounter}`

    let allowed: number, count: number, limit: number
    try {
      [allowed, count, limit] = await redis.eval(
        LUA_SLIDE, 1, key, now, rule.window * 1000, rule.limit, uid,
      ) as [number, number, number]
    } catch {
      return next()
    }

    c.header('X-RateLimit-Limit', String(limit))
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - (count as number))))

    if (!allowed) {
      rateLimitHitsTotal.inc({ prefix: rule.prefix })
      c.header('Retry-After', String(rule.window))
      return c.json({ status: 'failure', message: 'rate limit exceeded' }, 429)
    }

    return next()
  }
}
