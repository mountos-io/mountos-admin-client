// Vendor bootstrap: runs before auth init and env validation.
// Override to load secrets from vault, inject env vars, etc.
export async function bootstrap(): Promise<void> {
}
