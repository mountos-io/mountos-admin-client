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
  capabilities: Capabilities
  webauthn?: WebAuthnState
}

export function toUserInfo(data: Record<string, unknown>): UserInfo {
  const u = (data.user ?? data) as Record<string, unknown>
  return {
    id: u.id as string,
    name: u.name as string,
    email: u.email as string | undefined,
    avatar: u.avatar as string | undefined,
    role: (u.role as string) ?? 'l2admin',
    capabilities: (data.capabilities ?? {}) as Capabilities,
    webauthn: data.webauthn as WebAuthnState | undefined,
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
