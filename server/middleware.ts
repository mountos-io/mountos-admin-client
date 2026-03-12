import type { MiddlewareHandler } from 'hono'

// Vendor auth middleware — VENDOR EDITS THIS FILE
// Validate the incoming session/cookie/token and set mountosUser in context.
//
// Example:
//   const session = await validateMySession(c.req.header('cookie'))
//   if (!session) return c.json({ error: 'unauthorized' }, 401)
//   c.set('mountosUser', { id: session.userId, name: session.name, email: session.email })

export const vendorAuth: MiddlewareHandler = async (c, next) => {
  // Stub: allow all requests in development
  // Replace with real session validation in production
  c.set('mountosUser', { id: 'dev-user', name: 'Developer', email: 'dev@localhost' })
  await next()
}
