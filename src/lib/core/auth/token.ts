import type { AuthAdapter, UserInfo } from './adapter.js'

export interface TokenAuthConfig {
  loginUrl: string
  logoutUrl: string
  userEndpoint: string
  tokenKey?: string
}

export class TokenAuthAdapter implements AuthAdapter {
  private readonly tokenKey: string

  constructor(private config: TokenAuthConfig) {
    this.tokenKey = config.tokenKey ?? 'mountos_token'
  }

  isAuthenticated(): boolean {
    return !!sessionStorage.getItem(this.tokenKey)
  }

  async signIn(): Promise<void> {
    window.location.href = this.config.loginUrl
  }

  async signOut(): Promise<void> {
    sessionStorage.removeItem(this.tokenKey)
    window.location.href = this.config.logoutUrl
  }

  async getUser(): Promise<UserInfo | null> {
    const token = sessionStorage.getItem(this.tokenKey)
    if (!token) return null
    try {
      const res = await fetch(this.config.userEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) return await res.json()
    } catch {}
    return null
  }

  async getRequestHeaders(): Promise<Record<string, string>> {
    const token = sessionStorage.getItem(this.tokenKey)
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }
}
