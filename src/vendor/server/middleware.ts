import type { MiddlewareHandler } from 'hono'

// Vendor authorization middleware — runs after base auth on /api/* routes.
// Has access to `c.get('mountosUser')` with `.role`.
// Return 403 to block, or call next() to proceed.
export const vendorAuthzMiddleware: MiddlewareHandler | undefined = undefined
