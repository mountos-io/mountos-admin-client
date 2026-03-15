import { toUserInfo, type AuthAdapter, type UserInfo } from './adapter.js'

export interface CookieAuthConfig {
  loginUrl: string
  logoutUrl: string
  userEndpoint: string
}

export class CookieAuthAdapter implements AuthAdapter {
  private user: UserInfo | null = null
  private checked = false

  constructor(private config: CookieAuthConfig) {}

  isAuthenticated(): boolean {
    return this.user !== null
  }

  async signIn(): Promise<void> {
    window.location.href = this.config.loginUrl
  }

  async signOut(): Promise<void> {
    this.user = null
    this.checked = false
    window.location.href = this.config.logoutUrl
  }

  async getUser(): Promise<UserInfo | null> {
    if (this.checked) return this.user
    try {
      const res = await fetch(this.config.userEndpoint, { credentials: 'include' })
      if (res.ok) {
        this.user = toUserInfo(await res.json())
        this.checked = true
      }
    } catch (e) {
      console.warn('Cookie auth: failed to fetch user:', e)
      this.user = null
    }
    return this.user
  }

  async getRequestHeaders(): Promise<Record<string, string>> {
    return {}
  }

  async tryRefreshToken(): Promise<boolean> {
    // Cookie auth relies on server-managed cookies; no client-side refresh needed
    return false
  }
}
