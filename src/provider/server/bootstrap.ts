// Provider bootstrap: runs before auth init and env validation.
// Use to load secrets from vault, inject env vars, or init provider services.
// Required env vars checked after this returns:
//   PROVIDER2DASHBOARD_VERIFICATION_KEY, DASHBOARD_SIGNING_KEY,
//   DASHBOARD_VERIFICATION_KEY, MOUNTOS_APPSERV_URL, MOUNTOS_SDK_SIGNING_KEY, REDIS_URL
export async function bootstrap(): Promise<void> {
}
