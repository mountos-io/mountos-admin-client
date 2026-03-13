import type { AuthAdapter } from '$lib/core/auth/adapter'
import { TokenAuthAdapter } from '$lib/core/auth/token'
import { appConfig } from './app'
import { vendorAuthAdapter } from '$vendor/config/auth'

const defaults: AuthAdapter = new TokenAuthAdapter({
  loginUrl: appConfig.loginUrl,
  logoutUrl: appConfig.logoutUrl,
  userEndpoint: '/api/me',
})

export const authAdapter: AuthAdapter = vendorAuthAdapter ?? defaults
