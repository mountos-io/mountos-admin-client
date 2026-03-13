// 4-bit CRUD flags: C=8 R=4 U=2 D=1. D valid only when CRU all set (0b1111)
export const Cap = { C: 8, R: 4, U: 2, D: 1 } as const
export type Capabilities = Record<string, number>

export interface AdminUser {
  id: string
  name: string
  email?: string
  role: string
}

export interface DashboardAuthConfig {
  sessionTTL: number  // seconds
  refreshTTL: number  // seconds
  roles: Record<string, Capabilities>
}

export interface CsrfConfig {
  whitelist: string[]  // path prefixes that bypass CSRF check
  origin?: string | string[] | ((origin: string) => boolean)
}

export interface ContentSecurityPolicy {
  defaultSrc: string[]
  scriptSrc: string[]
  styleSrc: string[]
  imgSrc: string[]
  connectSrc: string[]
  fontSrc: string[]
  objectSrc: string[]
  frameAncestors: string[]
  baseUri: string[]
  formAction: string[]
}
