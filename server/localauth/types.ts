export const PORTAL_STATUS = {
  invited: 'invited',
  active: 'active',
  disabled: 'disabled',
} as const
export type PortalStatus = typeof PORTAL_STATUS[keyof typeof PORTAL_STATUS]

export const TOKEN_KIND = {
  invite: 'invite',
  verifyEmail: 'verify_email',
  resetPassword: 'reset_password',
} as const
export type TokenKind = typeof TOKEN_KIND[keyof typeof TOKEN_KIND]

export interface PortalUser {
  id: string
  email: string
  name: string
  role: string
  accountId: number | null
  appservUserId: number | null
  status: PortalStatus
  passwordHash: string
  passwordAlgo: string
  totpSecretEnc: string | null
  totpEnabledAt: Date | null
  totpSetupRequired: boolean
  emailVerifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface PortalToken {
  id: string
  userId: string
  kind: TokenKind
  tokenHash: string
  expiresAt: Date
  consumedAt: Date | null
}

export interface LocalAuthConfig {
  databaseUrl: string
  passwordPepper: string
  totpEncKey: string
  appUrl: string
  emailProvider: string
  emailFrom: string
}
