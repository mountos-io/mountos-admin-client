import UserIcon from '@lucide/svelte/icons/user'
import DatabaseIcon from '@lucide/svelte/icons/database'
import BuildingIcon from '@lucide/svelte/icons/building'
import HardDriveIcon from '@lucide/svelte/icons/hard-drive'
import ShieldIcon from '@lucide/svelte/icons/shield'
import GlobeIcon from '@lucide/svelte/icons/globe'
import KeyIcon from '@lucide/svelte/icons/key'
import MonitorIcon from '@lucide/svelte/icons/monitor'
import ServerIcon from '@lucide/svelte/icons/server'
import ScrollIcon from '@lucide/svelte/icons/scroll'
import ChartBarIcon from '@lucide/svelte/icons/chart-bar'
import GitForkIcon from '@lucide/svelte/icons/git-fork'
import GaugeIcon from '@lucide/svelte/icons/gauge'

export type SubjectMeta = { color: string; icon: typeof UserIcon }

const fallback: SubjectMeta = { color: 'var(--muted-foreground)', icon: ServerIcon }

export const subjectMeta: Record<string, SubjectMeta> = {
  user:           { color: 'var(--pastel-user)',          icon: UserIcon },
  volume:         { color: 'var(--pastel-volume)',        icon: DatabaseIcon },
  account:        { color: 'var(--pastel-account)',       icon: BuildingIcon },
  storage:        { color: 'var(--pastel-storage)',       icon: HardDriveIcon },
  role:           { color: 'var(--pastel-role)',          icon: ShieldIcon },
  region:         { color: 'var(--pastel-region)',        icon: GlobeIcon },
  mount:          { color: 'var(--pastel-mount)',         icon: HardDriveIcon },
  'volume.key':   { color: 'var(--pastel-volume-key)',    icon: KeyIcon },
  session:        { color: 'var(--pastel-session)',       icon: MonitorIcon },
  node:           { color: 'var(--pastel-node)',          icon: ServerIcon },
  license:        { color: 'var(--pastel-license)',       icon: ScrollIcon },
  'volume.stats': { color: 'var(--pastel-volume-stats)', icon: ChartBarIcon },
  'volume.fork':  { color: 'var(--pastel-volume-fork)',  icon: GitForkIcon },
  quota:          { color: 'var(--pastel-quota)',         icon: GaugeIcon },
}

export const allSubjects = Object.keys(subjectMeta)

export function getSubjectMeta(subject?: string): SubjectMeta {
  return subjectMeta[subject ?? ''] ?? fallback
}

export function getSubjectColor(subject?: string): string {
  return subjectMeta[subject ?? '']?.color ?? fallback.color
}
