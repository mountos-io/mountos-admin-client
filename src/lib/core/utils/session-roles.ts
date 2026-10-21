// Client session roles. The client reports its kind under metadata.role, and a
// job reports its detail under metadata.<role>. The server keeps the role a
// free string, so a role this build does not know still renders as a neutral
// job badge and never as a mount.

export type BadgeVariant = 'default' | 'success' | 'primary' | 'secondary' | 'warning' | 'destructive' | 'outline'

export interface RoleSpec {
  label: string
  variant: BadgeVariant
  title: string
  // The session has a mount path to show (a mount or a one-shot utility).
  showsMountPath: boolean
  // FUSE I/O metrics apply to the session.
  showsFuseIo: boolean
  // The job detail panel title, absent for non-job roles.
  jobTitle?: string
}

const ROLES: Record<string, RoleSpec> = {
  mount: { label: 'Mount', variant: 'default', title: 'Mount', showsMountPath: true, showsFuseIo: true },
  gateway: { label: 'Gateway', variant: 'primary', title: 'S3/HDFS gateway, no FUSE mount', showsMountPath: false, showsFuseIo: true },
  utility: { label: 'Utility', variant: 'outline', title: 'One-shot utility session, not a mount', showsMountPath: true, showsFuseIo: true },
  upload: { label: 'Upload', variant: 'secondary', title: 'Bulk upload job, no FUSE mount', showsMountPath: false, showsFuseIo: false, jobTitle: 'Upload Job' },
  download: { label: 'Download', variant: 'secondary', title: 'Bulk download job, no FUSE mount', showsMountPath: false, showsFuseIo: true, jobTitle: 'Download Job' },
  sink: { label: 'Sink', variant: 'secondary', title: 'HLS-to-mountOS ingest sink, no FUSE mount', showsMountPath: false, showsFuseIo: false, jobTitle: 'Sink Job' },
  clone: { label: 'Clone', variant: 'secondary', title: 'Tree clone job, no FUSE mount', showsMountPath: false, showsFuseIo: false, jobTitle: 'Clone Job' },
  rm: { label: 'Remove', variant: 'secondary', title: 'Tree removal job, no FUSE mount', showsMountPath: false, showsFuseIo: false, jobTitle: 'Remove Job' },
}

const MAX_ROLE_LABEL = 24

// Keeps printable ASCII only and caps the length, because the role string comes
// from the client.
function safeRoleText(role: string): string {
  const cleaned = role.replace(/[^\x20-\x7e]/g, '').trim()
  return cleaned.length > MAX_ROLE_LABEL ? `${cleaned.slice(0, MAX_ROLE_LABEL)}…` : cleaned
}

// The role string of a session. Absent or empty reads as a mount.
export function sessionRole(metadata: unknown): string {
  if (metadata == null || typeof metadata !== 'object') return 'mount'
  const r = (metadata as Record<string, unknown>).role
  return typeof r === 'string' && r !== '' ? r : 'mount'
}

export function isKnownRole(role: string): boolean {
  return Object.hasOwn(ROLES, role)
}

// The display spec of a role. An unknown role is a neutral "Job (role)" badge
// with no mount path and no FUSE metrics.
export function roleSpec(role: string): RoleSpec {
  if (isKnownRole(role)) return ROLES[role]!
  const text = safeRoleText(role)
  return {
    label: text ? `Job (${text})` : 'Job',
    variant: 'outline',
    title: 'Client job of a kind this console does not know',
    showsMountPath: false,
    showsFuseIo: false,
    jobTitle: 'Job',
  }
}

export const TREE_JOB_ROLES = ['clone', 'rm'] as const
export function isTreeJobRole(role: string): role is (typeof TREE_JOB_ROLES)[number] {
  return role === 'clone' || role === 'rm'
}

// Shows the fork and the start of a fork://path value. The admin plane gets
// paths from clients, so a long path is cut instead of shown whole.
export function truncateForkPath(value: string | undefined, maxPath = 40): string | undefined {
  if (value == null || value === '') return undefined
  const i = value.indexOf('://')
  const fork = i < 0 ? '' : value.slice(0, i)
  const path = i < 0 ? value : value.slice(i + 3)
  const head = fork.length > 32 ? `${fork.slice(0, 32)}…` : fork
  const body = path.length > maxPath ? `${path.slice(0, maxPath)}…` : path
  return i < 0 ? body : `${head}://${body}`
}

// Clone and rm job detail under metadata.clone and metadata.rm.
export interface TreeJobInfo {
  jobId?: string
  source?: string
  destination?: string
  // Snapshot cut in microseconds since the epoch, absent for a live source.
  snapshotTs?: number
  state?: string
  haltReason?: string
  processed?: number
  actionsDone?: number
  actionsTotal?: number
  actions?: number
  logPath?: string
  cloned?: number
  overwritten?: number
  skipped?: number
  failed?: number
  protected?: number
  removed?: number
}

export function treeJobInfo(metadata: unknown, role: string): TreeJobInfo | null {
  if (!isTreeJobRole(role) || metadata == null || typeof metadata !== 'object') return null
  const d = (metadata as Record<string, unknown>)[role]
  return d != null && typeof d === 'object' ? (d as TreeJobInfo) : null
}

// The outcome rows of a tree job, in display order.
export function treeJobOutcomes(role: string, info: TreeJobInfo): { label: string; value: number; tone: 'bad' | 'plain' }[] {
  const n = (v: number | undefined) => (typeof v === 'number' ? v : 0)
  if (role === 'rm') {
    return [
      { label: 'Removed', value: n(info.removed), tone: 'plain' },
      { label: 'Skipped', value: n(info.skipped), tone: 'plain' },
      { label: 'Protected', value: n(info.protected), tone: 'plain' },
      { label: 'Failed', value: n(info.failed), tone: n(info.failed) > 0 ? 'bad' : 'plain' },
    ]
  }
  return [
    { label: 'Cloned', value: n(info.cloned), tone: 'plain' },
    { label: 'Overwritten', value: n(info.overwritten), tone: 'plain' },
    { label: 'Skipped', value: n(info.skipped), tone: 'plain' },
    { label: 'Failed', value: n(info.failed), tone: n(info.failed) > 0 ? 'bad' : 'plain' },
  ]
}
