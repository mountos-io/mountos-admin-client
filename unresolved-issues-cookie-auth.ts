// Pre-existing security issues identified during cookie auth review (not introduced by this change)
//
// 1. Refresh token replay — no jti tracking / single-use enforcement.
//    Same refresh token reusable until expiry. Fix: add jti claim + server-side revocation list.
//
// 2. CSP headers not configured — no Content-Security-Policy header set.
//    Add via Hono's secureHeaders() config or custom middleware.
//
// 3. No explicit CSRF origin in vendorCsrfConfig — defaults to same-origin.
//    Vendors deploying admin on a different domain must set vendorCsrfConfig.origin.
