import type { ContentSecurityPolicy, CsrfConfig, DashboardAuthConfig, RateLimitRule, StepUpRule, ThrottleConfig, WebAuthnConfig } from '../../../server/types'

// Session/refresh token lifetimes. Defaults: session=24h, refresh=7d.
// Tokens use Ed25519 EdDSA signing; cookies are httpOnly + SameSite=Strict + Secure (non-dev).
// Refresh tokens are single-use (jti tracked in Redis); replayed tokens are rejected.
// Override `roles` to add provider-specific roles or change capability mappings.
// e.g. roles: { provider_ops: { accounts: 14, users: 4, regions: 4, ... } }
export const providerAuthConfig: Partial<DashboardAuthConfig> = {
}

// CSRF: Hono's csrf() middleware runs on all /api/* routes.
// - `origin`: allowed origin(s) for non-GET requests. Unset = same-origin only.
//   Set to provider's domain(s) if admin is served from a different origin than the API.
// - `whitelist`: path prefixes that bypass CSRF (e.g., ['/api/webhooks/'] for callback endpoints).
//   Only whitelist paths that use their own auth (e.g., HMAC signature verification).
export const providerCsrfConfig: Partial<CsrfConfig> = {
}

// CSP: merged with base defaults (self-only policy). Override directives as needed.
// e.g., imgSrc: ["'self'", 'data:', 'https://cdn.example.com'] to allow external images.
export const providerCspConfig: Partial<ContentSecurityPolicy> = {
}

export const providerStepUpRules: StepUpRule[] = []
export const providerWebAuthnConfig: Partial<WebAuthnConfig> = {}

// Rate limiting: override or add rules for provider-specific endpoints.
// Defaults protect auth exchange (30/60s), auth refresh (20/60s), and webauthn (15/60s).
export const providerRateLimitRules: RateLimitRule[] = []

// Token-level throttle: caps authenticated API requests per user.
// Default: 25 requests per second. Override limit/window as needed.
export const providerThrottleConfig: Partial<ThrottleConfig> = {}
