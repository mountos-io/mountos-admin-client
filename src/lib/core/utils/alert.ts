import ShieldAlert from '@lucide/svelte/icons/shield-alert'
import AlertTriangle from '@lucide/svelte/icons/triangle-alert'
import Info from '@lucide/svelte/icons/info'
import { TIME_RANGES, CATEGORIES } from '$lib/core/stores/alerts.svelte'

export function severityBadgeVariant(severity: number): 'destructive' | 'warning' | 'default' {
  if (severity === 2) return 'destructive'
  if (severity === 1) return 'warning'
  return 'default'
}

export function severityIcon(severity: number) {
  if (severity === 2) return ShieldAlert
  if (severity === 1) return AlertTriangle
  return Info
}

export const severityOptions: readonly { value: string; label: string }[] = [
  { value: '', label: 'All Severities' },
  { value: '2', label: 'Critical' },
  { value: '1', label: 'Warning' },
  { value: '0', label: 'Info' },
]

export const categoryOptions: readonly { value: string; label: string }[] = [
  { value: '', label: 'All Categories' },
  ...CATEGORIES.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
]

export const timeOptions: readonly { value: string; label: string }[] =
  TIME_RANGES.map(r => ({ value: r.value, label: r.label }))

export function handleTabKeydown(e: KeyboardEvent) {
  const el = e.currentTarget as HTMLElement
  const parent = el.parentElement
  if (!parent) return
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    const next = el.nextElementSibling ?? parent.firstElementChild
    ;(next as HTMLElement | null)?.focus()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    const prev = el.previousElementSibling ?? parent.lastElementChild
    ;(prev as HTMLElement | null)?.focus()
  }
}
