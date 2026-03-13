// Vendor server middleware — not used in auth pipeline.
// Auth is fully handled by base code (ed25519 JWT).
//
// To add vendor-specific middleware (e.g., IP allowlisting, request logging, rate limiting):
// 1. Export a Hono middleware function from this file
// 2. Import and mount it in server/server.ts via app.use()
// Note: CSRF is already configured via vendorCsrfConfig in config.ts — do not duplicate it here.
