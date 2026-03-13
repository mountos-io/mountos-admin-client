import type { CsrfConfig, DashboardAuthConfig } from '../../../server/types'

// Session/refresh token lifetimes. Defaults: session=24h, refresh=7d.
// Tokens use Ed25519 EdDSA signing; cookies are httpOnly + SameSite=Strict + Secure (non-dev).
export const vendorAuthConfig: Partial<DashboardAuthConfig> = {
}

// CSRF: Hono's csrf() middleware runs on all /api/* routes.
// - `origin`: allowed origin(s) for non-GET requests. Unset = same-origin only.
//   Set to vendor's domain(s) if admin is served from a different origin than the API.
// - `whitelist`: path prefixes that bypass CSRF (e.g., ['/api/webhooks/'] for callback endpoints).
//   Only whitelist paths that use their own auth (e.g., HMAC signature verification).
// Note: JSON POST endpoints (/api/auth/logout, /api/auth/refresh) are implicitly CSRF-safe
// (browsers can't send JSON via form submission), but the middleware adds defense-in-depth.
export const vendorCsrfConfig: CsrfConfig = {
}
