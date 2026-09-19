import type { LocalAuthConfig } from './types'

export const LOCAL_LOGIN_ENABLED = !!process.env.MOUNTOS_PORTAL_DATABASE_URL

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

// Only call once LOCAL_LOGIN_ENABLED is confirmed true — mirrors the
// required/missing fail-fast idiom in server/server.ts, scoped to this
// extension so a default deployment (no portal DB URL) never evaluates it.
export function loadLocalAuthConfig(): LocalAuthConfig {
  const required = ['MOUNTOS_PORTAL_DATABASE_URL', 'MOUNTOS_PORTAL_PASSWORD_PEPPER', 'MOUNTOS_PORTAL_TOTP_ENC_KEY', 'MOUNTOS_PORTAL_APP_URL', 'EMAIL_PROVIDER', 'EMAIL_FROM']
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(`Missing required local-login env: ${missing.join(', ')}`)
  }
  return {
    databaseUrl: requireEnv('MOUNTOS_PORTAL_DATABASE_URL'),
    passwordPepper: requireEnv('MOUNTOS_PORTAL_PASSWORD_PEPPER'),
    totpEncKey: requireEnv('MOUNTOS_PORTAL_TOTP_ENC_KEY'),
    appUrl: requireEnv('MOUNTOS_PORTAL_APP_URL').replace(/\/+$/, ''),
    emailProvider: requireEnv('EMAIL_PROVIDER'),
    emailFrom: requireEnv('EMAIL_FROM'),
  }
}
