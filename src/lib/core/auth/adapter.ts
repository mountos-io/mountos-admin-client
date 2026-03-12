export interface UserInfo {
  id: string
  name: string
  email?: string
  avatar?: string
  roles?: string[]
}

export interface AuthAdapter {
  isAuthenticated(): boolean
  signIn(): Promise<void>
  signOut(): Promise<void>
  getUser(): Promise<UserInfo | null>
  getRequestHeaders(): Promise<Record<string, string>>
}
