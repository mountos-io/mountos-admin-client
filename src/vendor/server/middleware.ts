import type { Context, MiddlewareHandler } from 'hono'
import type { AdminUser } from '../../../server/types'

// Return authenticated user or null to reject with 401
export async function authenticate(_c: Context): Promise<AdminUser | null> {
  // Stub: allow all requests in development
  return { id: 'dev-user', name: 'Developer', email: 'dev@localhost' }
}

// Additional middlewares (CSRF, rate limiting, etc.) applied before routes
export const middlewares: MiddlewareHandler[] = []
