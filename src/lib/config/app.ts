import { vendorAppConfig } from '$vendor/config/app'

export interface AppConfig {
  appName: string
  logoUrl: string
  faviconUrl: string
  proxyBaseUrl: string
  loginUrl: string
  logoutUrl: string
}

const defaults: AppConfig = {
  appName: 'mountOS Admin',
  logoUrl: '/logo.svg',
  faviconUrl: '/favicon.png',
  proxyBaseUrl: '/api/v1',
  loginUrl: '/login',
  logoutUrl: '/login',
}

export const appConfig: AppConfig = { ...defaults, ...vendorAppConfig }
