import type { ContentSecurityPolicy, CsrfConfig, DashboardAuthConfig, StepUpRule, WebAuthnConfig } from '../../../server/types'

// Session/refresh token lifetimes. Defaults: session=24h, refresh=7d.
// Tokens use Ed25519 EdDSA signing; cookies are httpOnly + SameSite=Strict + Secure (non-dev).
// Refresh tokens are single-use (jti tracked in Redis); replayed tokens are rejected.
// Override `roles` to add vendor-specific roles or change capability mappings.
// e.g. roles: { vendor_ops: { accounts: 14, users: 4, regions: 4, ... } }
export const vendorAuthConfig: Partial<DashboardAuthConfig> = {
}

// CSRF: Hono's csrf() middleware runs on all /api/* routes.
// - `origin`: allowed origin(s) for non-GET requests. Unset = same-origin only.
//   Set to vendor's domain(s) if admin is served from a different origin than the API.
// - `whitelist`: path prefixes that bypass CSRF (e.g., ['/api/webhooks/'] for callback endpoints).
//   Only whitelist paths that use their own auth (e.g., HMAC signature verification).
export const vendorCsrfConfig: Partial<CsrfConfig> = {
}

// CSP: merged with base defaults (self-only policy). Override directives as needed.
// e.g., imgSrc: ["'self'", 'data:', 'https://cdn.example.com'] to allow external images.
export const vendorCspConfig: Partial<ContentSecurityPolicy> = {
}

export const vendorStepUpRules: StepUpRule[] = []
export const vendorWebAuthnConfig: Partial<WebAuthnConfig> = {}
