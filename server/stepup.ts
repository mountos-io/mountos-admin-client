import type { MiddlewareHandler } from 'hono'
import type { StepUpRule } from './types'
import type { WebAuthnManager } from './webauthn'

const DEFAULTS: StepUpRule[] = [
  { method: 'DELETE', pattern: /^\/api\/v1\// },
  { method: 'DELETE', pattern: /^\/api\/webauthn\/credentials\// },
  { method: 'POST', pattern: /^\/api\/v1\/.*\/lock$/ },
  { method: 'POST', pattern: /^\/api\/v1\/.*\/unlock$/ },
  { method: 'POST', pattern: /^\/api\/v1\/.*\/api-keys\/revoke$/ },
]

function matches(rules: StepUpRule[], method: string, path: string): boolean {
  return rules.some(r => (!r.method || r.method === method) && r.pattern.test(path))
}

export function createStepUpMiddleware(
  manager: WebAuthnManager,
  providerRules: StepUpRule[] = [],
): MiddlewareHandler {
  const rules = [...DEFAULTS, ...providerRules]
  return async (c, next) => {
    if (!matches(rules, c.req.method, c.req.path)) return next()

    const user = c.get('mountosUser')
    if (!user || !await manager.hasCredentials(user.id)) return next()

    const token = c.req.header('x-stepup-token')
    if (!token) return c.json({ status: 'step-up-required', message: 'step-up authentication required' }, 403)

    if (!await manager.consumeStepUpToken(token, user.id)) {
      return c.json({ status: 'step-up-invalid', message: 'step-up token invalid or expired' }, 403)
    }
    return next()
  }
}
