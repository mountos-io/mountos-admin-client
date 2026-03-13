import type { CsrfConfig, DashboardAuthConfig } from '../../../server/types'

export const vendorAuthConfig: Partial<DashboardAuthConfig> = {
}

// Paths in whitelist bypass CSRF enforcement (e.g., webhook callbacks)
export const vendorCsrfConfig: CsrfConfig = {
}
