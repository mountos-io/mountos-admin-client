export type Capabilities = Record<string, number>

export interface UserInfo {
  id: string
  name: string
  email?: string
  avatar?: string
  role: string
  capabilities: Capabilities
}

export interface AuthAdapter {
  isAuthenticated(): boolean
  signIn(): Promise<void>
  signOut(): Promise<void>
  getUser(): Promise<UserInfo | null>
  getRequestHeaders(): Promise<Record<string, string>>
}
