import { ROLE } from '../../../../server/types'
export { ROLE, isAdmin, type Role } from '../../../../server/types'

export type Capabilities = Record<string, number>

export interface WebAuthnState {
  enrolled: boolean
  credentialCount: number
}

export interface UserInfo {
  id: string
  name: string
  email?: string
  avatar?: string
  role: string
  username?: string
  capabilities: Capabilities
  webauthn?: WebAuthnState
  accountId?: number
  userId?: number
  volumeId?: number
}

export function toUserInfo(data: Record<string, unknown>): UserInfo {
  const u = (data.user ?? data) as Record<string, unknown>
  return {
    id: u.id as string,
    name: u.name as string,
    email: u.email as string | undefined,
    avatar: u.avatar as string | undefined,
    role: (u.role as string) ?? ROLE.l2admin,
    username: u.username as string | undefined,
    capabilities: (data.capabilities ?? {}) as Capabilities,
    webauthn: data.webauthn as WebAuthnState | undefined,
    accountId: u.accountId as number | undefined,
    userId: u.userId as number | undefined,
    volumeId: u.volumeId as number | undefined,
  }
}

export interface AuthAdapter {
  isAuthenticated(): boolean
  signIn(): Promise<void>
  signOut(): Promise<void>
  getUser(): Promise<UserInfo | null>
  getRequestHeaders(): Promise<Record<string, string>>
  /** Attempt to refresh the session token. Returns true if refreshed successfully. */
  tryRefreshToken(): Promise<boolean>
}
