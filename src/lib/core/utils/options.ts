export const POLL_OPTIONS = [
  { value: '', label: 'Poll Off' },
  { value: '5', label: '5s' },
  { value: '10', label: '10s' },
  { value: '15', label: '15s' },
  { value: '30', label: '30s' },
  { value: '60', label: '60s' },
] as const

export const SESSION_POLL_OPTIONS = [
  { value: '', label: 'Off' },
  { value: '60', label: '1m' },
  { value: '120', label: '2m' },
  { value: '300', label: '5m' },
] as const
