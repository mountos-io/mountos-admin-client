import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import type { WebAuthnState } from '$lib/core/auth/adapter'

interface StoredCredential {
  id: string
  publicKey: string
  counter: number
  transports: string[]
  label: string
  createdAt: string
  lastUsedAt: string
}

let enrolled = $state(false)
let credentialCount = $state(0)
let credentials = $state<StoredCredential[]>([])
let loading = $state(false)

async function api(path: string, method = 'GET', body?: unknown) {
  const token = sessionStorage.getItem('mountos_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api/webauthn${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message ?? `WebAuthn request failed (${res.status})`)
  }
  return res.json()
}

export function useWebAuthn() {
  return {
    get enrolled() { return enrolled },
    get credentialCount() { return credentialCount },
    get credentials() { return credentials },
    get loading() { return loading },

    setEnrollmentState(s: WebAuthnState | undefined) {
      enrolled = s?.enrolled ?? false
      credentialCount = s?.credentialCount ?? 0
    },

    async fetchCredentials() {
      loading = true
      try {
        credentials = await api('/credentials')
        credentialCount = credentials.length
        enrolled = credentials.length > 0
      } finally {
        loading = false
      }
    },

    async registerCredential(label: string) {
      const options = await api('/register/options', 'POST')
      const attestation = await startRegistration({ optionsJSON: options })
      const cred = await api('/register/verify', 'POST', { response: attestation, label })
      credentials = [...credentials, cred]
      credentialCount = credentials.length
      enrolled = true
    },

    async authenticate(): Promise<string> {
      const options = await api('/authenticate/options', 'POST')
      const assertion = await startAuthentication({ optionsJSON: options })
      const { stepUpToken } = await api('/authenticate/verify', 'POST', { response: assertion })
      return stepUpToken
    },

    async deleteCredential(id: string) {
      await api(`/credentials/${encodeURIComponent(id)}`, 'DELETE')
      credentials = credentials.filter(c => c.id !== id)
      credentialCount = credentials.length
      enrolled = credentials.length > 0
    },

    async renameCredential(id: string, label: string) {
      await api(`/credentials/${encodeURIComponent(id)}`, 'PATCH', { label })
      credentials = credentials.map(c => c.id === id ? { ...c, label } : c)
    },
  }
}
