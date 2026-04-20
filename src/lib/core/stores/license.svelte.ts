import type { LicenseDetails, LicenseStatus } from '$lib/core/api/types'
import { api } from './client.svelte'

let license = $state<LicenseDetails | null>(null)
let loading = $state(false)
let error = $state<string | null>(null)
let terms = $state<string | null>(null)
let termsLoading = $state(false)
let fetchCtrl: AbortController | null = null

const needsAttention = $derived<boolean>(
  license != null && license.status !== 'valid'
)

const badgeVariant = $derived.by<'success' | 'warning' | 'destructive' | undefined>(() => {
  if (!license) return undefined
  if (license.status === 'expired' || license.status === 'expired_access') return 'destructive'
  if (license.status === 'grace' || license.status === 'expiring') return 'warning'
  if (license.status === 'valid') return 'success'
  return undefined
})

async function fetchLicense() {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  error = null
  try {
    license = await api.license.get(ctrl.signal)
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    error = (e as Error).message || 'Failed to load license'
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

function statusLabel(status: LicenseStatus): string {
  switch (status) {
    case 'valid': return 'Valid'
    case 'expiring': return 'Expiring Soon'
    case 'grace': return 'Grace Period'
    case 'expired_access': return 'Expired Access'
    case 'expired': return 'Expired'
  }
}

function formatLimit(value: number, unit?: string): string {
  if (value <= 0) return 'Unlimited'
  if (unit === 'bytes') {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    let v = value
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
    return `${Math.round(v * 100) / 100} ${units[i]}`
  }
  return value.toLocaleString()
}

async function fetchTerms() {
  if (terms || termsLoading) return
  termsLoading = true
  try {
    const res = await api.license.terms()
    terms = res.terms
  } catch {
    terms = null
  } finally {
    termsLoading = false
  }
}

export function useLicense() {
  return {
    get license() { return license },
    get loading() { return loading },
    get error() { return error },
    get terms() { return terms },
    get termsLoading() { return termsLoading },
    get needsAttention() { return needsAttention },
    get badgeVariant() { return badgeVariant },
    fetchLicense,
    fetchTerms,
    statusLabel,
    formatLimit,
  }
}
