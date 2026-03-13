import type { AuthAdapter, UserInfo } from './adapter.js'

export interface TokenAuthConfig {
  loginUrl: string
  logoutUrl: string
  userEndpoint: string
  tokenKey?: string
  refreshKey?: string
}

export class TokenAuthAdapter implements AuthAdapter {
  private readonly tokenKey: string
  private readonly refreshKey: string

  constructor(private config: TokenAuthConfig) {
    this.tokenKey = config.tokenKey ?? 'mountos_token'
    this.refreshKey = config.refreshKey ?? 'mountos_refresh'
  }

  isAuthenticated(): boolean {
    return !!sessionStorage.getItem(this.tokenKey)
  }

  storeTokens(token: string, refreshToken?: string) {
    sessionStorage.setItem(this.tokenKey, token)
    if (refreshToken) sessionStorage.setItem(this.refreshKey, refreshToken)
  }

  clearTokens() {
    sessionStorage.removeItem(this.tokenKey)
    sessionStorage.removeItem(this.refreshKey)
  }

  async signIn(): Promise<void> {
    window.location.href = this.config.loginUrl
  }

  async signOut(): Promise<void> {
    this.clearTokens()
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    window.location.href = this.config.logoutUrl
  }

  async getUser(): Promise<UserInfo | null> {
    const token = sessionStorage.getItem(this.tokenKey)
    if (!token) return this.bootstrapFromCookie()
    try {
      const res = await fetch(this.config.userEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        return data.user ?? data
      }
      if (res.status === 401) return await this.tryRefresh()
    } catch {}
    return null
  }

  private async bootstrapFromCookie(): Promise<UserInfo | null> {
    try {
      const res = await fetch(this.config.userEndpoint)
      if (!res.ok) return null
      const data = await res.json()
      if (data.token) this.storeTokens(data.token, data.refreshToken)
      return data.user ?? data
    } catch {
      return null
    }
  }

  async getRequestHeaders(): Promise<Record<string, string>> {
    const token = sessionStorage.getItem(this.tokenKey)
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }

  private async tryRefresh(): Promise<UserInfo | null> {
    const refreshToken = sessionStorage.getItem(this.refreshKey)
    if (!refreshToken) return null
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        this.clearTokens()
        return null
      }
      const data = await res.json()
      this.storeTokens(data.token, data.refreshToken)
      // Verify new session token directly (avoid recursion via getUser)
      const userRes = await fetch(this.config.userEndpoint, {
        headers: { Authorization: `Bearer ${data.token}` },
      })
      if (userRes.ok) {
        const userData = await userRes.json()
        return userData.user ?? userData
      }
      this.clearTokens()
      return null
    } catch {
      this.clearTokens()
      return null
    }
  }
}
