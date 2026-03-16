import { toUserInfo, type AuthAdapter, type UserInfo } from './adapter.js'
import type { Account } from '$lib/core/api/types'

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
  private _bootstrapAccount: Account | null = null

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

  getBootstrapAccount(): Account | null {
    return this._bootstrapAccount
  }

  private cacheBootstrapData(data: Record<string, unknown>) {
    this._bootstrapAccount = (data.account as Account | undefined) ?? null
  }

  async signIn(): Promise<void> {
    window.location.href = this.config.loginUrl
  }

  async signOut(): Promise<void> {
    this.clearTokens()
    this._bootstrapAccount = null
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }) } catch (e) { console.warn('Logout request failed:', e) }
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
        this.cacheBootstrapData(data)
        return toUserInfo(data)
      }
      if (res.status === 401) return await this.tryRefresh()
    } catch (e) {
      console.warn('Failed to fetch user:', e)
    }
    return null
  }

  private async bootstrapFromCookie(): Promise<UserInfo | null> {
    try {
      const res = await fetch(this.config.userEndpoint, { credentials: 'same-origin' })
      if (!res.ok) return null
      const data = await res.json()
      if (data.token) this.storeTokens(data.token, data.refreshToken)
      this.cacheBootstrapData(data)
      return toUserInfo(data)
    } catch (e) {
      console.warn('Cookie bootstrap failed:', e)
      return null
    }
  }

  async getRequestHeaders(): Promise<Record<string, string>> {
    const token = sessionStorage.getItem(this.tokenKey)
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }

  async tryRefreshToken(): Promise<boolean> {
    const refreshToken = sessionStorage.getItem(this.refreshKey)
    if (!refreshToken) return false
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        this.clearTokens()
        return false
      }
      const data = await res.json()
      this.storeTokens(data.token, data.refreshToken)
      return true
    } catch (e) {
      console.warn('Token refresh failed:', e)
      this.clearTokens()
      return false
    }
  }

  private async tryRefresh(): Promise<UserInfo | null> {
    const refreshed = await this.tryRefreshToken()
    if (!refreshed) return null
    try {
      const res = await fetch(this.config.userEndpoint, {
        headers: await this.getRequestHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        this.cacheBootstrapData(data)
        return toUserInfo(data)
      }
      this.clearTokens()
      return null
    } catch (e) {
      console.warn('Session refresh failed:', e)
      this.clearTokens()
      return null
    }
  }
}
