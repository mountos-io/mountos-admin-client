export interface AdminUser {
  id: string
  name: string
  email?: string
}

export interface DashboardAuthConfig {
  sessionTTL: number  // seconds
  refreshTTL: number  // seconds
}

export interface CsrfConfig {
  whitelist?: string[]  // path prefixes that bypass CSRF check
  origin?: string | string[] | ((origin: string) => boolean)
}
