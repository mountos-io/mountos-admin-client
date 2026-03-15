import type { MiddlewareHandler, Context } from 'hono'
import type Redis from 'ioredis'
import type { RateLimitRule } from './types'
import { rateLimitHitsTotal } from './metrics'

export interface RateLimitConfig {
  rules: RateLimitRule[]
  /** Additional vendor rules merged after defaults */
  vendorRules?: RateLimitRule[]
}

const LUA_SLIDE = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then return {0, count, limit} end
redis.call('ZADD', key, now, now .. ':' .. math.random(1, 1000000))
redis.call('EXPIRE', key, window)
return {1, count + 1, limit}`

function keyFor(prefix: string, ip: string): string {
  return `mountos:rl:${prefix}:${ip}`
}

function clientIp(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    ?? c.req.header('x-real-ip')
    ?? '0.0.0.0'
}

function matchRule(rules: RateLimitRule[], path: string): RateLimitRule | undefined {
  return rules.find(r => path.startsWith(r.prefix))
}

export function createRateLimiter(redis: Redis, config: RateLimitConfig): MiddlewareHandler {
  const rules = [...config.rules, ...(config.vendorRules ?? [])]

  return async (c, next) => {
    const rule = matchRule(rules, c.req.path)
    if (!rule) return next()

    const ip = clientIp(c)
    const key = keyFor(rule.prefix, ip)
    const now = Date.now()

    const [allowed, count, limit] = await redis.eval(
      LUA_SLIDE, 1, key, now, rule.window * 1000, rule.limit,
    ) as [number, number, number]

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
