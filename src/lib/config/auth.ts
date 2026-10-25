import type { AuthAdapter } from '#lib/core/auth/adapter.js'
import { TokenAuthAdapter } from '#lib/core/auth/token.js'
import { appConfig } from './app'
import { providerAuthAdapter } from '#provider/config/auth.js'

const defaults: AuthAdapter = new TokenAuthAdapter({
  loginUrl: appConfig.loginUrl,
  logoutUrl: appConfig.logoutUrl,
  userEndpoint: '/api/me',
})

export const authAdapter: AuthAdapter = providerAuthAdapter ?? defaults
