// 4-bit CRUD flags: C=8 R=4 U=2 D=1. D valid only when CRU all set (0b1111)
export const Cap = { C: 8, R: 4, U: 2, D: 1 } as const
export type Capabilities = Record<string, number>

export interface AdminUser {
  id: string
  name: string
  email?: string
  role: string
  username?: string
  accountId?: number
  userId?: number
  volumeId?: number
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

export interface StepUpRule {
  method?: string
  pattern: RegExp
}

export interface WebAuthnConfig {
  rpId: string
  rpName: string
  origin: string
}

export interface StoredCredential {
  id: string
  publicKey: string
  counter: number
  transports: string[]
  label: string
  createdAt: string
  lastUsedAt: string
}

export interface RateLimitRule {
  prefix: string
  limit: number
  window: number
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
