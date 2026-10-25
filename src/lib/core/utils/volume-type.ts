import type { BadgeVariant } from '#lib/components/ui/badge/index.js'

export const VOLUME_TYPE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'iceberg', label: 'Iceberg' },
  { value: 'lance', label: 'Lance' },
]

// Lake volumes (Iceberg, Lance) use the primary badge. A POSIX volume or an
// unknown type uses the neutral badge.
export function volumeTypeVariant(type: string | undefined): BadgeVariant {
  return type === 'iceberg' || type === 'lance' ? 'primary' : 'secondary'
}
