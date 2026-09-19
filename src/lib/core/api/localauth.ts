// Thin client for the native-login extension's own endpoints (/api/auth/local/*).
// These sit outside the generated appserv SDK, so requests go straight through
// fetch with the same auth-header + cookie pattern used by revokeAdminSessions
// in stores/users.svelte.ts.
import { authAdapter } from '$lib/config/auth'

async function authHeaders(): Promise<Record<string, string>> {
  return { 'Content-Type': 'application/json', ...await authAdapter.getRequestHeaders() }
}

async function req<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: await authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) throw new Error((data.message as string) || 'Request failed')
  return data as T
}

export interface TotpStatus {
  isPortalUser: boolean
  totpEnabled: boolean
}

export interface TotpEnrollStart {
  secretBase32: string
  otpauthUri: string
}

export type PortalInviteStatus = 'none' | 'invited' | 'active' | 'disabled'

export async function fetchLocalLoginEnabled(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/local/config', { credentials: 'same-origin' })
    if (!res.ok) return false
    const data = await res.json() as { enabled?: boolean }
    return data.enabled === true
  } catch {
    return false
  }
}

export const localAuthApi = {
  totpStatus: () => req<TotpStatus>('/api/auth/local/totp/status', 'GET'),
  totpEnrollStart: (currentCode?: string) =>
    req<TotpEnrollStart>('/api/auth/local/totp/enroll/start', 'POST', currentCode ? { currentCode } : {}),
  totpEnrollVerify: (code: string) =>
    req<{ status: string; backupCodes: string[] }>('/api/auth/local/totp/enroll/verify', 'POST', { code }),
  regenerateBackupCodes: (currentCode: string) =>
    req<{ status: string; backupCodes: string[] }>('/api/auth/local/totp/backup-codes/regenerate', 'POST', { currentCode }),
  deletePasskey: (credentialId: string, code: string) =>
    req<{ status: string }>('/api/auth/local/passkey/delete', 'POST', { credentialId, code }),
  inviteAdmin: (body: { email: string; name: string; role: string }) =>
    req<{ status: string; id: string; emailSent: boolean }>('/api/auth/local/invite/admin', 'POST', body),
  switchAdminRole: (body: { email: string; role: string }) =>
    req<{ status: string }>('/api/auth/local/admin/role', 'POST', body),
  inviteUser: (body: { email: string; name: string; accountId: number; appservUserId: number }) =>
    req<{ status: string; id: string; emailSent: boolean }>('/api/auth/local/invite/user', 'POST', body),
  resendInvite: (email: string) =>
    req<{ status: string; emailSent: boolean }>('/api/auth/local/invite/resend', 'POST', { email }),
  inviteStatus: (email: string) =>
    req<{ inviteStatus: PortalInviteStatus; role?: string; emailVerified: boolean; totpEnabled: boolean }>(
      `/api/auth/local/invite/status?email=${encodeURIComponent(email)}`, 'GET',
    ),
}
