import type { MiddlewareHandler } from 'hono'
import { dashboardAuth } from './auth'

export const auth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  if (!bearer) return c.json({ status: 'failure', message: 'unauthorized' }, 401)

  try {
    const user = await dashboardAuth.verifySessionToken(bearer)
    if (await dashboardAuth.isUserRevoked(user.username)) {
      return c.json({ status: 'failure', message: 'session revoked' }, 401)
    }
    c.set('mountosUser', user)
    await next()
  } catch {
    return c.json({ status: 'failure', message: 'unauthorized' }, 401)
  }
}
