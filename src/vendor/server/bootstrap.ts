// Vendor bootstrap: runs before auth init and env validation.
// Use to load secrets from vault, inject env vars, or init vendor services.
// Required env vars checked after this returns:
//   VENDOR2DASHBOARD_VERIFICATION_KEY, DASHBOARD_SIGNING_KEY,
//   DASHBOARD_VERIFICATION_KEY, MOUNTOS_APPSERV_URL, MOUNTOS_SDK_SIGNING_KEY
export async function bootstrap(): Promise<void> {
}
