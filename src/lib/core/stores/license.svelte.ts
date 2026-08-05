import type { LicenseDetails, LicenseStatus } from '$lib/core/api/types'
import { api, request } from './client.svelte'

let license = $state<LicenseDetails | null>(null)
let loading = $state(false)
let error = $state<string | null>(null)
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

// parsePayloads splits raw license text into one trimmed payload per non-empty line, the format the
// HUB accepts whether the text came from a file or a paste box.
function parsePayloads(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (t) out.push(t)
  }
  return out
}

// postPayloads sends the signed (JWT-like) license payloads to the HUB as an array; the HUB verifies
// each and returns an error if any is invalid. Payloads are deduped by content hash server-side.
// Refreshes the active license on success.
async function postPayloads(licenses: string[]) {
  await request('POST', '/api/v1/license/load', { payloads: licenses })
  await fetchLicense()
}

// uploadLicense loads one or more license payloads from the selected file(s).
async function uploadLicense(files: FileList | File[]) {
  const licenses: string[] = []
  for (const f of Array.from(files)) licenses.push(...parsePayloads(await f.text()))
  if (!licenses.length) throw new Error('No license payloads found in the selected file(s)')
  await postPayloads(licenses)
}

// pasteLicense loads license payload(s) from pasted text; no file needed.
async function pasteLicense(text: string) {
  const licenses = parsePayloads(text)
  if (!licenses.length) throw new Error('No license payload found in the pasted text')
  await postPayloads(licenses)
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

// formatLimit renders a license cap. For count caps, value <= 0 is the
// "unlimited" sentinel and renders as ∞. The storage cap has no such
// sentinel of its own: a non-positive value is enforced as zero allowance,
// so bytes always render as a factual count (0 → "0 B", never ∞) UNLESS the
// license explicitly grants unlimitedStorage (e.g. an AWS Marketplace
// non-trial SKU, billed per-instance rather than per-byte) - a marketplace
// trial SKU leaves unlimitedStorage false and still shows its real cap.
function formatLimit(value: number, unit?: string, unlimited?: boolean): string {
  if (unit === 'bytes') return unlimited ? '∞' : formatBytes(Math.max(0, value))
  if (value <= 0) return '∞'
  return value.toLocaleString()
}

// formatBytes renders a factual byte count. 0 → "0 B" (NOT ∞).
function formatBytes(value: number): string {
  if (value < 0) return '-'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let i = 0
  let v = value
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${Math.round(v * 100) / 100} ${units[i]}`
}

export function useLicense() {
  return {
    get license() { return license },
    get loading() { return loading },
    get error() { return error },
    get needsAttention() { return needsAttention },
    get badgeVariant() { return badgeVariant },
    fetchLicense,
    uploadLicense,
    pasteLicense,
    statusLabel,
    formatLimit,
    formatBytes,
  }
}
