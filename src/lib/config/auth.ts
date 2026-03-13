import type { AuthAdapter } from '$lib/core/auth/adapter'
import { CookieAuthAdapter } from '$lib/core/auth/cookie'
import { appConfig } from './app'
import { vendorAuthAdapter } from '$vendor/config/auth'

const defaults: AuthAdapter = new CookieAuthAdapter({
  loginUrl: appConfig.loginUrl,
  logoutUrl: appConfig.logoutUrl,
  userEndpoint: '/api/me',
})

export const authAdapter: AuthAdapter = vendorAuthAdapter ?? defaults
