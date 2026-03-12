// VENDOR EDITS HERE
import type { AuthAdapter } from '$lib/core/auth/adapter'
import { CookieAuthAdapter } from '$lib/core/auth/cookie'
import { appConfig } from './app'

export const authAdapter: AuthAdapter = new CookieAuthAdapter({
  loginUrl: appConfig.loginUrl,
  logoutUrl: appConfig.logoutUrl,
  userEndpoint: '/api/me',
})
