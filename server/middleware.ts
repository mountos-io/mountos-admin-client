import type { MiddlewareHandler } from 'hono'
import { authenticate, middlewares as vendorMiddlewares } from '../src/vendor/server/middleware'

export const auth: MiddlewareHandler = async (c, next) => {
  const user = await authenticate(c)
  if (!user) return c.json({ status: 'failure', message: 'unauthorized' }, 401)
  c.set('mountosUser', user)
  await next()
}

export { vendorMiddlewares }
