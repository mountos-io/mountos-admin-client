<script lang="ts">
  import { onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useUsers } from '$lib/core/stores/users.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { cn, debounce } from '$lib/utils'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover'
  import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '$lib/components/ui/command'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import DeactivateVolumeDialog from '$lib/components/shared/DeactivateVolumeDialog.svelte'
  import DetailSkeleton from '$lib/components/shared/DetailSkeleton.svelte'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import ListSkeleton from '$lib/components/shared/ListSkeleton.svelte'
  import { formatBytes, formatQuota, quotaPercent, bytesToGb, gbToBytes, formatClientType, formatSessionStatus, formatDuration, formatRelative } from '$lib/core/utils/format'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import { api } from '$lib/core/stores/client.svelte'
  import type { Volume, User, DeactivateVolumeRequest, ClientSession, Fork, CreateVolumeForkRequest, VolumeSizePoint } from '$lib/core/api/types'
  import VolumeSizeHistoryChart from '$lib/components/shared/VolumeSizeHistoryChart.svelte'
  import { handleApiError, showErrorToast, showSuccessToast } from '$lib/core/utils/toast'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import FieldLabel from '$lib/components/shared/FieldLabel.svelte'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import Check from '@lucide/svelte/icons/check'
  import Loader2 from '@lucide/svelte/icons/loader-2'
  import * as Dialog from '$lib/components/ui/dialog'
  import Copy from '@lucide/svelte/icons/copy'
  import Plus from '@lucide/svelte/icons/plus'
  import ShieldAlert from '@lucide/svelte/icons/shield-alert'
  import { Select } from '$lib/components/ui/select'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import DateTimePicker from '$lib/components/shared/DateTimePicker.svelte'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import { sanitizeForkName, forkNameErrorMessage } from '$lib/core/utils/validation'

  const store = useVolumes()
  const userStore = useUsers()
  const auth = useAuth()
  const id = $derived(Number($page.params.id))

  $effect(() => {
    if (auth.loading) return
    if (!auth.can('volumes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    if (auth.isUserRole && auth.userVolumeId != null && id !== auth.userVolumeId) {
      showErrorToast('Access denied')
      goto('/volumes', { replaceState: true })
    }
  })

  let volume = $state<Volume | null>(null)
  let loading = $state(true)
  const dialog = useConfirmDialog(() => reload())
  const canEdit = $derived(volume?.isActive && auth.can('volumes', 'update'))

  let editing = $state(false)
  let deactivateOpen = $state(false)
  let reactivating = $state(false)

  async function handleReactivate() {
    if (!volume) return
    dialog.confirm(
      'Reactivate Volume',
      `Reactivate "${volume.name}"? Allowed only while cleanup has not begun. The server returns an error if any cleanup flag has fired.`,
      async () => {
        reactivating = true
        try {
          await store.activateVolume(id)
          showSuccessToast('Volume reactivated')
        } catch (e: unknown) {
          handleApiError(e, 'Failed to reactivate volume')
        } finally {
          reactivating = false
        }
      },
    )
  }

  let deleteForkTarget = $state<ForkNode | null>(null)
  let deleteForkForce = $state(false)
  let deleteForkOpen = $state(false)
  let deleteForkLoading = $state(false)

  function confirmDeleteFork(node: ForkNode) {
    deleteForkTarget = node
    deleteForkForce = node.children.length > 0
    deleteForkOpen = true
  }

  async function handleDeleteFork() {
    if (!deleteForkTarget || !volume) return
    deleteForkLoading = true
    try {
      await store.deleteFork(id, deleteForkTarget.name, {
        force: deleteForkForce,
        volumeType: volume.volumeType,
      })
      showSuccessToast(`Fork "${deleteForkTarget.name}" marked for deletion`)
      deleteForkOpen = false
      deleteForkTarget = null
      await fetchForks()
    } catch (err) {
      handleApiError(err, 'Failed to delete fork')
    } finally {
      deleteForkLoading = false
    }
  }

  let restoreForkTarget = $state<ForkNode | null>(null)
  let restoreForkOpen = $state(false)
  let restoreForkLoading = $state(false)

  function confirmRestoreFork(node: ForkNode) {
    restoreForkTarget = node
    restoreForkOpen = true
  }

  async function handleRestoreFork() {
    if (!restoreForkTarget || !volume) return
    restoreForkLoading = true
    try {
      await store.restoreFork(id, restoreForkTarget.name, {
        volumeType: volume.volumeType,
      })
      showSuccessToast(`Fork "${restoreForkTarget.name}" restored`)
      restoreForkOpen = false
      restoreForkTarget = null
      await fetchForks()
    } catch (err) {
      handleApiError(err, 'Failed to restore fork')
    } finally {
      restoreForkLoading = false
    }
  }

  let createForkOpen = $state(false)
  let createForkName = $state('')
  let createForkParent = $state('')
  let createForkLoading = $state(false)
  let createForkAsOfEnabled = $state(false)
  let createForkAsOfLocal = $state('')

  function toDatetimeLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // Round up to the next whole minute so the value is strictly within the
  // server's bound (server compares at microsecond precision against the
  // exact volume creation / retention timestamps).
  function ceilDatetimeLocal(d: Date): string {
    const ms = d.getTime()
    const rounded = ms % 60_000 === 0 ? ms : (Math.floor(ms / 60_000) + 1) * 60_000
    return toDatetimeLocal(new Date(rounded))
  }

  // Mirror of gcserv DefaultDataRetentionDays; fallback when the volume
  // has no plan-level retention set, so the picker bound matches the server.
  const DEFAULT_RETENTION_DAYS = 30

  // Effective lower bound = gcThreshold = min(now - retention, min(existing
  // fork snapshot_ts)). Mirrors dataserv handleForksCreate + gcserv
  // getEffectiveRetentionThreshold exactly. No separate volume.createdAt floor
  // needed: any existing fork's snapshot_ts is already >= volume.createdAt.
  // GC floor in ms: mirrors dataserv's gcThreshold = min(now - retention,
  // min over all forks of snapshot_ts). Keyed only on volume.retentionPeriod
  // and forks; doesn't re-run when createForkParent toggles.
  const gcFloorMs = $derived.by(() => {
    if (!volume) return 0
    const days = volume.retentionPeriod > 0 ? volume.retentionPeriod : DEFAULT_RETENTION_DAYS
    let floor = Date.now() - days * 86400_000
    for (const f of forks) {
      const snapMs = Math.floor(f.snapshotTs / 1000)
      if (snapMs < floor) floor = snapMs
    }
    return floor
  })

  // Parent-snapshot floor: only tightens the bound when a non-main parent is
  // chosen. Mirrors dataserv's parent-snapshot guard.
  const parentFloorMs = $derived.by(() => {
    if (!createForkParent || createForkParent === 'main') return 0
    const parent = forks.find(f => f.name === createForkParent)
    return parent ? Math.floor(parent.snapshotTs / 1000) : 0
  })

  const createForkAsOfMin = $derived.by(() => {
    if (!volume) return ''
    return ceilDatetimeLocal(new Date(Math.max(gcFloorMs, parentFloorMs)))
  })

  // Upper bound is minute-floor(now): the current in-progress minute is
  // disallowed, matching the server's minuteNow check. If now is exactly on a
  // minute boundary the just-ended minute is reachable.
  const createForkAsOfMax = $derived(toDatetimeLocal(new Date(Math.floor(Date.now() / 60_000) * 60_000)))

  function openCreateFork() {
    createForkName = ''
    createForkParent = 'main'
    createForkAsOfEnabled = false
    createForkAsOfLocal = toDatetimeLocal(new Date())
    createForkOpen = true
  }

  const createForkSanitized = $derived(sanitizeForkName(createForkName.trim()))
  const createForkNameError = $derived(forkNameErrorMessage(createForkSanitized))
  const createForkNameChanged = $derived(
    createForkName.trim().length > 0 && createForkSanitized !== createForkName.trim()
  )

  async function handleCreateFork() {
    if (!volume) return
    const finalName = createForkSanitized
    if (forkNameErrorMessage(finalName)) return
    if (createForkAsOfEnabled && !createForkAsOfLocal) return
    createForkLoading = true
    try {
      const req: CreateVolumeForkRequest = { name: finalName }
      if (createForkParent && createForkParent !== 'main') req.parentName = createForkParent
      if (createForkAsOfEnabled) {
        req.asOf = new Date(createForkAsOfLocal).getTime() * 1000
      }
      req.volumeType = volume.volumeType
      await store.createFork(id, req)
      showSuccessToast(`Fork "${finalName}" created`)
      createForkOpen = false
      await fetchForks()
    } catch (err) {
      handleApiError(err, 'Failed to create fork')
    } finally {
      createForkLoading = false
    }
  }

  async function handleDeactivate(req: DeactivateVolumeRequest) {
    await store.deactivateVolume(id, req)
    await reload()
  }

  let revokeUserId = $state('')
  let genResult = $state<{ apiKey: string; apiSecret: string } | null>(null)
  let credentialsOpen = $state(false)
  let userSelectOpen = $state(false)
  let userSearchQuery = $state('')
  let userOptions = $state<User[]>([])
  let userSearchLoading = $state(false)
  const selectedUserLabel = $derived(userOptions.find(u => String(u.id) === revokeUserId)?.username ?? (revokeUserId ? `User #${revokeUserId}` : ''))

  const debouncedUserSearch = debounce(async (accountId: number, query: string) => {
    userSearchLoading = true
    try {
      userOptions = await userStore.searchUsers(accountId, query)
    } catch { /* swallow */ }
    finally { userSearchLoading = false }
  }, 300)

  $effect(() => {
    if (!userSelectOpen) return
    if (!volume?.account?.id) return
    debouncedUserSearch(volume.account.id, userSearchQuery)
  })

  let revokeKey = $state('')
  let editDesc = $state('')
  let editRetention = $state('')
  let editGrace = $state('')
  let editQuota = $state('')
  let editRestrictByLive = $state(false)
  let editSaving = $state(false)

  const editDirty = $derived(
    volume != null && (
      editDesc !== (volume.description ?? '') ||
      editRetention !== String(volume.retentionPeriod) ||
      editGrace !== String(volume.gracePeriod) ||
      editQuota !== String(bytesToGb(volume.quotaLimit)) ||
      editRestrictByLive !== volume.restrictByLiveVolume
    )
  )

  function syncEditFields(v: Volume) {
    editDesc = v.description ?? ''
    editRetention = String(v.retentionPeriod)
    editGrace = String(v.gracePeriod)
    editQuota = String(bytesToGb(v.quotaLimit))
    editRestrictByLive = v.restrictByLiveVolume
  }

  let volFetchCtrl: AbortController | undefined
  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    volFetchCtrl?.abort()
    volFetchCtrl = new AbortController()
    const ctrl = volFetchCtrl
    volSessions = []; sessionsTotal = 0; sessionsTotalPages = 0; sessionsPage = 1
    loading = true
    store.getVolume(id).then(v => {
      if (ctrl.signal.aborted) return
      volume = v
      syncEditFields(v)
      fetchVolumeSessions()
      fetchForks()
    }).catch(() => { if (!ctrl.signal.aborted) volume = null }).finally(() => { if (!ctrl.signal.aborted) loading = false })
  })

  onDestroy(() => { volFetchCtrl?.abort(); sessionsCtrl?.abort(); sizeCtrl?.abort() })

  async function reload() {
    const v = await store.getVolume(id)
    volume = v
    syncEditFields(v)
  }

  function cancelEdit() {
    if (volume) syncEditFields(volume)
    editing = false
  }

  async function saveEdit() {
    if (!volume) return
    editSaving = true
    try {
      const quotaChanged = editQuota !== String(bytesToGb(volume.quotaLimit))
      await store.editVolume(id, {
        description: editDesc.trim() || undefined,
        retentionPeriod: editRetention ? Number(editRetention) : undefined,
        gracePeriod: editGrace ? Number(editGrace) : undefined,
        restrictByLiveVolume: editRestrictByLive,
      })
      if (quotaChanged) {
        const gb = Number(editQuota)
        await store.updateQuota({ volumeId: id, quotaLimit: isNaN(gb) || gb <= 0 ? 0 : gbToBytes(gb) })
      }
      showSuccessToast('Volume updated')
      editing = false
      await reload()
    } catch (e: unknown) { handleApiError(e, 'Failed to update volume') }
    finally { editSaving = false }
  }

  function generateKeys() {
    const uid = auth.userMountosUserId
    if (uid == null) return
    dialog.confirm('Generate API Keys', 'Any existing key pair for this user will be revoked.', async () => {
      try {
        genResult = await store.generateApiKeys(id, { userId: uid })
        credentialsOpen = true
      } catch (e: unknown) { handleApiError(e, 'Failed to generate keys') }
    })
  }

  function closeCredentials() {
    credentialsOpen = false
    genResult = null
  }

  let copiedField = $state<string | null>(null)
  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text)
      copiedField = field
      setTimeout(() => { if (copiedField === field) copiedField = null }, 1500)
    } catch { showErrorToast('Failed to copy') }
  }

  function handleRevokeKey() {
    if (!revokeKey) return
    const key = revokeKey
    dialog.confirm('Revoke API Key', `Revoke key "${key}"?`, async () => {
      await store.revokeApiKey(id, key)
      revokeKey = ''
      showSuccessToast('API key revoked')
    }, 'destructive')
  }

  let volSessions = $state<ClientSession[]>([])
  let sessionsLoading = $state(false)
  let sessionsTotal = $state(0)
  let sessionsTotalPages = $state(0)
  let sessionsPage = $state(1)
  let sessionsCtrl: AbortController | null = null

  async function fetchVolumeSessions(page = 1) {
    if (!volume) return
    sessionsCtrl?.abort()
    const ctrl = sessionsCtrl = new AbortController()
    sessionsLoading = true
    try {
      const res = await api.clientSessions.list({
        accountId: volume.account.id,
        volumeId: id,
        page,
        limit: 10,
      }, ctrl.signal)
      volSessions = res.items
      sessionsTotal = res.pagination?.total ?? 0
      sessionsTotalPages = res.pagination?.totalPages ?? 0
      sessionsPage = res.pagination?.page ?? 1
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    } finally {
      if (sessionsCtrl === ctrl) sessionsLoading = false
    }
  }

  let forks = $state<Fork[]>([])
  let forksLoading = $state(false)

  type SizeRange = '24h' | '7d' | '30d' | '1y'
  const sizeRangeDays: Record<SizeRange, number> = { '24h': 1, '7d': 7, '30d': 30, '1y': 366 }
  let sizeRange = $state<SizeRange>('30d')
  let sizePoints = $state<VolumeSizePoint[]>([])
  let sizeLoading = $state(false)
  let sizeCtrl: AbortController | null = null

  async function fetchSizeHistory() {
    if (!volume) return
    sizeCtrl?.abort()
    const ctrl = sizeCtrl = new AbortController()
    sizeLoading = true
    try {
      const to = new Date()
      const from = new Date(to.getTime() - sizeRangeDays[sizeRange] * 86400_000)
      const res = await store.sizeHistory({ volumeId: id, from: from.toISOString(), to: to.toISOString() })
      if (ctrl.signal.aborted) return
      sizePoints = res.points
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      sizePoints = []
    } finally {
      if (sizeCtrl === ctrl) sizeLoading = false
    }
  }

  $effect(() => { void sizeRange; if (volume) fetchSizeHistory() })

  const forkParentOptions = $derived(
    forks.filter(f => f.status === 'active').map(f => ({ value: f.name, label: f.name }))
  )

  async function fetchForks() {
    if (!volume) return
    forksLoading = true
    try {
      forks = await store.listAllForks(id, volume.volumeType)
    } catch { forks = [] }
    finally { forksLoading = false }
  }

  type ForkNode = Fork & { children: ForkNode[] }

  function buildForkTree(forks: Fork[]): ForkNode[] {
    const map = new Map<number, ForkNode>()
    for (const f of forks) map.set(f.fid, { ...f, children: [] })
    const roots: ForkNode[] = []
    for (const node of map.values()) {
      const parent = map.get(node.parentFid)
      if (parent && parent !== node) parent.children.push(node)
      else roots.push(node)
    }
    for (const node of map.values()) {
      node.children.sort((a, b) => a.createdAt - b.createdAt)
    }
    return roots
  }

  function formatTimestamp(ms: number): string {
    if (!ms) return ''
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function formatShortDate(ms: number): string {
    if (!ms) return ''
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  let forkView = $state<'list' | 'timeline'>('list')

  const FORK_COLORS = 8

  function graphColor(index: number): string {
    if (index < FORK_COLORS) {
      return `var(--fork-${index})`
    }
    const hue = (index * 137.508) % 360
    return `oklch(0.65 0.15 ${hue.toFixed(1)})`
  }

  interface BranchRow {
    fid: number; name: string; row: number; parentRow: number
    branchNorm: number; snapshotTs: number; createdAt: number
    createdBy?: string; color: string; status: string; size: number
  }

  function computeGraph(items: Fork[]) {
    const tree = buildForkTree(items)
    const rows: BranchRow[] = []
    const timestamps: number[] = []
    const occupied = new Set<number>()

    function claimRow(preferred: number, direction: number): number {
      let r = preferred
      while (occupied.has(r)) r += direction
      occupied.add(r)
      return r
    }

    function walkRoot(node: ForkNode) {
      occupied.add(0)
      rows.push({ fid: node.fid, name: node.name, row: 0, parentRow: 0, branchNorm: 0,
        snapshotTs: node.snapshotTs, createdAt: node.createdAt, createdBy: node.createdBy, color: graphColor(0), status: node.status, size: node.size })
      for (let i = 0; i < node.children.length; i++) {
        walkChild(node.children[i], 0, i % 2 === 0 ? -1 : 1)
      }
    }

    function walkChild(node: ForkNode, parentRow: number, direction: number) {
      if (node.snapshotTs) timestamps.push(node.snapshotTs)
      const row = claimRow(parentRow + direction, direction)
      const ci = rows.length
      rows.push({ fid: node.fid, name: node.name, row, parentRow, branchNorm: 0,
        snapshotTs: node.snapshotTs, createdAt: node.createdAt, createdBy: node.createdBy, color: graphColor(ci), status: node.status, size: node.size })
      for (let i = 0; i < node.children.length; i++) {
        walkChild(node.children[i], row, i % 2 === 0 ? direction : -direction)
      }
    }

    for (const root of tree) walkRoot(root)

    timestamps.sort((a, b) => a - b)
    const minTs = timestamps[0] ?? 0, maxTs = timestamps[timestamps.length - 1] ?? 0, range = maxTs - minTs || 1
    for (const r of rows) r.branchNorm = r.fid === 0 ? 0 : (r.snapshotTs - minTs) / range

    const minRow = Math.min(...rows.map(r => r.row))
    for (const r of rows) { r.row -= minRow; r.parentRow -= minRow }
    const rowColorMap = new Map<number, string>()
    for (const r of rows) rowColorMap.set(r.row, r.color)
    return { rows, totalRows: Math.max(...rows.map(r => r.row)) + 1, rowColorMap }
  }

  const G_ROW = 52, G_TOP = 20, G_LEFT = 24, G_LABEL = 160, G_TIMELINE = 480, G_RIGHT = 200, G_DOT = 5, G_CR = 12
  function gRowY(row: number) { return G_TOP + row * G_ROW + G_ROW / 2 }
  function gTimeX(norm: number) { return G_LEFT + G_LABEL + norm * G_TIMELINE }
  const gNowX = G_LEFT + G_LABEL + G_TIMELINE

  function gBranchPath(pRow: number, cRow: number, bx: number) {
    const py = gRowY(pRow), cy = gRowY(cRow), dy = cy - py
    const r = Math.min(G_CR, Math.abs(dy) / 2, 12), sign = dy > 0 ? 1 : -1
    return `M${bx},${py} L${bx},${cy - sign * r} Q${bx},${cy} ${bx + r},${cy}`
  }

  function handleRevokeKeysByUser() {
    const uid = Number(revokeUserId)
    if (!revokeUserId || Number.isNaN(uid)) return
    const label = selectedUserLabel || `User #${uid}`
    dialog.confirm('Revoke Key', `Revoke API key for ${label}?`, async () => {
      await store.revokeApiKeysByUser({ volumeId: id, userId: uid })
      showSuccessToast(`API key revoked for ${label}`)
    }, 'destructive')
  }
</script>

<svelte:head>
  <title>{volume?.name ?? 'Volume'} · mountOS Admin</title>
</svelte:head>

{#snippet sessionsHeaderRow()}
  <TableRow>
    <TableHead class="th-cyber">Client</TableHead>
    <TableHead class="th-cyber hidden md:table-cell">Host</TableHead>
    <TableHead class="th-cyber hidden lg:table-cell">Mount</TableHead>
    <TableHead class="th-cyber">Status</TableHead>
    <TableHead class="th-cyber hidden md:table-cell">Duration</TableHead>
    <TableHead class="th-cyber hidden lg:table-cell">Last Heartbeat</TableHead>
  </TableRow>
{/snippet}

<div class="space-y-6">
  <div class="flex items-center gap-4 flex-wrap">
    <Button variant="ghost" size="sm" href="/volumes" aria-label="Back to volumes"><ArrowLeft class="h-4 w-4" /></Button>
    <h1 class="text-2xl font-bold tracking-tight min-w-0 truncate">{volume?.name ?? 'Volume'}</h1>
    {#if volume}
      <Badge variant="outline" style="border-color: var(--pastel-volume); color: var(--pastel-volume-text)">Volume</Badge>
      <Badge variant={volume.volumeType === 'iceberg' ? 'primary' : 'secondary'} class="capitalize" aria-label="Volume type {volume.volumeType}">{volume.volumeType}</Badge>
    {/if}
  </div>
  {#if loading}
    <DetailSkeleton cards={[{ rows: 5, cols: 1 }]} />
  {:else if volume}
    {#if !volume.isActive}
      <section
        aria-labelledby="volume-deactivated-heading"
        class="rounded-md border border-warning/70 bg-warning/15 px-4 py-3 text-base flex flex-wrap items-center gap-3"
      >
        <ShieldAlert class="size-4 shrink-0 text-warning" aria-hidden="true" />
        <span class="flex-1 min-w-[200px]">
          <span id="volume-deactivated-heading" class="font-semibold">Deactivated.</span>
          Cleanup begins after the grace period. Reactivation is only possible while no cleanup flag has fired.
        </span>
        {#if auth.can('volumes', 'update')}
          <Button
            variant="primary" size="sm"
            class="cyberpunk-skewed-sm min-h-[44px] sm:min-h-0"
            disabled={reactivating}
            aria-busy={reactivating}
            onclick={handleReactivate}
          >
            {#if reactivating}<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />{/if}
            Reactivate
          </Button>
        {/if}
      </section>
    {/if}
    <div class="grid gap-6">
      <Card cornerBrackets>
        <CardHeader>
          <div class="flex items-center gap-3">
            <CardTitle class="flex-1">Details</CardTitle>
            {#if canEdit && !editing}
              <button
                type="button"
                onclick={() => (editing = true)}
                class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-50 hover:opacity-100 hover:text-primary transition-[color,opacity]"
                title="Edit volume" aria-label="Edit volume"
              >
                <PencilIcon class="size-4" aria-hidden="true" />
              </button>
            {/if}
          </div>
        </CardHeader>
        <CardContent class="grid gap-3">
          {#if editing}
            <div class="space-y-1.5">
              <Label for="edit-desc" class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Description</Label>
              <Textarea id="edit-desc" bind:value={editDesc} placeholder="Volume description" rows={2} />
            </div>
          {:else if volume.description}
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Description</span>
              <p class="mt-1 text-sm break-words">{volume.description}</p>
            </div>
          {/if}
          <div class="flex flex-wrap gap-6">
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Status</span>
              <div class="mt-1"><StatusBadge active={volume.isActive} locked={volume.locked} /></div>
            </div>
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Kind</span>
              <div class="mt-1"><Badge variant={volume.volumeType === 'iceberg' ? 'primary' : 'secondary'} class="capitalize">{volume.volumeType}</Badge></div>
            </div>
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Encryption</span>
              <div class="mt-1"><Badge variant={volume.encryption ? 'default' : 'outline'}>{volume.encryption ? 'Enabled' : 'Disabled'}</Badge></div>
            </div>
          </div>
          {#if editing}
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-1.5">
                <FieldLabel for="edit-retention" tooltip="How long deleted items and old versions are retained before cleanup. Beyond this window, snapshot mounts may show inconsistent data due to cleaned-up data." class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                  Snapshot Window (days)
                </FieldLabel>
                <Input id="edit-retention" type="number" bind:value={editRetention} placeholder="30" min="0" max="366" />
              </div>
              <div class="space-y-1.5">
                <FieldLabel for="edit-grace" tooltip="How long data stays before cleanup after deactivation" class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                  Grace Period (days)
                </FieldLabel>
                <Input id="edit-grace" type="number" bind:value={editGrace} placeholder="14" min="0" max="91" />
              </div>
            </div>
          {:else}
            <div class="flex gap-4">
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Snapshot Window</span>
                <p class="mt-1 text-sm">{volume.retentionPeriod} days</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Grace Period</span>
                <p class="mt-1 text-sm">{volume.gracePeriod} days</p>
              </div>
            </div>
          {/if}
          {#if !volume.isActive}
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                Cleanup
                <InfoTip text="Can be changed on deactivate" />
              </span>
              <div class="mt-1 flex gap-2" role="list" aria-label="Cleanup flags">
                <span role="listitem"><Badge variant={volume.isCleanupMetaEnabled ? 'default' : 'outline'} aria-label="Meta: {volume.isCleanupMetaEnabled ? 'enabled' : 'disabled'}">Meta</Badge></span>
                <span role="listitem"><Badge variant={volume.isCleanupStorageEnabled ? 'default' : 'outline'} aria-label="Storage: {volume.isCleanupStorageEnabled ? 'enabled' : 'disabled'}">Storage</Badge></span>
                <span role="listitem"><Badge variant={volume.isCleanupVaultEnabled ? 'default' : 'outline'} aria-label="Vault: {volume.isCleanupVaultEnabled ? 'enabled' : 'disabled'}">Vault</Badge></span>
              </div>
            </div>
          {/if}
          {#if editing}
            <div class="space-y-1.5">
              <Label for="edit-quota" class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Quota Limit (GB)</Label>
              <Input id="edit-quota" type="number" bind:value={editQuota} placeholder="0 = unlimited" min="0" step="0.01" />
            </div>
            {#if auth.can('volumes', 'update')}
              <div class="flex items-center gap-2">
                <Checkbox id="edit-restrict-live" bind:checked={editRestrictByLive} />
                <Label for="edit-restrict-live" class="text-sm inline-flex items-center gap-1">
                  Restrict quota by live volume
                  <InfoTip text="When enabled, quota enforcement uses live volume instead of total volume" />
                </Label>
              </div>
            {/if}
          {:else}
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                Quota
                {#if volume.restrictByLiveVolume}
                  <Badge variant="outline" class="text-sm px-1.5 py-0 font-normal normal-case tracking-normal">live-restricted</Badge>
                {/if}
              </span>
              <p class="mt-1 text-sm">{formatQuota(volume.totalVolume, volume.quotaLimit)}</p>
              {#if volume.quotaLimit > 0}
                {@const pct = quotaPercent(volume.totalVolume, volume.quotaLimit)}
                <div class="mt-2 h-2 rounded-sm bg-muted overflow-hidden" role="progressbar"
                  aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                  aria-label="Quota usage {pct}%">
                  <div class="h-full rounded-sm transition-transform origin-left {pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-warning' : 'bg-primary'}" style="transform: scaleX({pct / 100})"></div>
                </div>
              {/if}
            </div>
            <div class="flex flex-wrap gap-4">
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Live
                  <InfoTip text={"Sum of all files across forks for this volume.\n\nCan exceed total volume due to hard links, sparse files, etc.\nOnly live (non-deleted, current version) files are tracked."} />
                </span>
                <p class="mt-1 font-mono text-sm">{formatBytes(volume.liveVolume)}</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Inactive
                  <InfoTip text={"Live volume from inactive (deleted) forks.\n\nThis data is pending cleanup and not accessible to clients."} />
                </span>
                <p class="mt-1 font-mono text-sm">{formatBytes(volume.liveInactiveVolume)}</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Total
                  <InfoTip text={"Object / block storage space used.\n\nIncludes all versions, pending, and yet-to-be-discarded file segments."} />
                </span>
                <p class="mt-1 font-mono text-sm">{formatBytes(volume.totalVolume)}</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Pending
                  <InfoTip text={"Pending or yet-to-be-discarded file segments.\n\nThese segments are scheduled for cleanup after the retention window expires."} />
                </span>
                <p class="mt-1 font-mono text-sm">{formatBytes(volume.pendingVolume)}</p>
              </div>
            </div>
          {/if}
        </CardContent>
        {#if editing}
          <CardFooter class="gap-4">
            <Button variant="primary" size="sm" class="cyberpunk-skewed-sm" disabled={editSaving || !editDirty} onclick={saveEdit}>
              {editSaving ? 'Saving...' : 'Update'}
            </Button>
            <Button variant="secondary" size="sm" onclick={cancelEdit} disabled={editSaving}>Cancel</Button>
          </CardFooter>
        {:else if auth.can('volumes', 'update') && volume.isActive}
          <CardFooter class="flex gap-2">
            <Button variant="destructive" size="sm" onclick={() => { deactivateOpen = true }}>Deactivate</Button>
            <Button variant="outline" size="sm" onclick={() => dialog.confirm(
              volume!.locked ? 'Unlock' : 'Lock',
              `${volume!.locked ? 'Unlock' : 'Lock'} "${volume!.name}"?`,
              () => volume!.locked ? store.unlockVolume(id) : store.lockVolume(id),
            )}>{volume.locked ? 'Unlock' : 'Lock'}</Button>
          </CardFooter>
        {/if}
      </Card>

    </div>

    <Card cornerBrackets>
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle>Size History</CardTitle>
          <div class="relative border border-border/30 rounded-sm px-3 py-2 w-fit">
            <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
            <div class="relative flex items-center gap-1.5" role="group" aria-label="Select size history range">
              {#each [['24h','24h'],['7d','7d'],['30d','30d'],['1y','1y']] as [val, label]}
                <Button variant={sizeRange === val ? 'primary' : 'ghost'} size="sm"
                  class="h-7 px-3 text-xs font-mono justify-center"
                  aria-pressed={sizeRange === val}
                  onclick={() => sizeRange = val as SizeRange}>{label}</Button>
              {/each}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {#if sizeLoading && sizePoints.length === 0}
          <ListSkeleton rows={3} />
        {:else}
          <VolumeSizeHistoryChart points={sizePoints} />
        {/if}
      </CardContent>
    </Card>

    <Card cornerBrackets>
      <CardHeader>
        <div class="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Forks ({forks.length})</CardTitle>
          <div class="flex items-center gap-2 flex-wrap">
          {#if forks.length > 1}
            <div class="relative border border-border/30 rounded-sm px-3 py-2 w-fit hidden md:block">
              <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
              <div class="relative flex items-center gap-1.5" role="group" aria-label="Fork view">
                <Button variant={forkView === 'list' ? 'primary' : 'ghost'} size="sm"
                  class="h-7 px-3 min-h-[44px] sm:min-h-0 text-xs font-mono justify-center"
                  aria-pressed={forkView === 'list'}
                  onclick={() => forkView = 'list'}>List</Button>
                <Button variant={forkView === 'timeline' ? 'primary' : 'ghost'} size="sm"
                  class="h-7 px-3 min-h-[44px] sm:min-h-0 text-xs font-mono justify-center"
                  aria-pressed={forkView === 'timeline'}
                  onclick={() => forkView = 'timeline'}>Timeline</Button>
              </div>
            </div>
          {/if}
          {#if canEdit}
            <Button variant="outline" size="sm" class="h-9 min-h-[44px] gap-1.5 text-xs" onclick={openCreateFork}>
              <Plus class="h-3.5 w-3.5" /> Create Fork
            </Button>
          {/if}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {#if forksLoading}
          <ListSkeleton rows={3} />
        {:else if forks.length === 0}
          <p class="text-sm text-muted-foreground">No forks</p>
        {:else if forkView === 'list'}
          {#snippet forkNode(node: ForkNode, depth: number, isLast: boolean)}
            <div class="flex items-start gap-2 {depth > 0 ? 'ml-5' : ''} {node.status !== 'active' ? 'opacity-60' : ''}" role="treeitem" aria-selected="false" aria-expanded={node.children.length > 0 ? true : undefined}>
              {#if depth > 0}
                <span class="shrink-0 text-muted-foreground/40 font-mono text-sm select-none" aria-hidden="true">{isLast ? '└─' : '├─'}</span>
              {/if}
              <div class="flex-1 min-w-0 py-0.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <Badge variant={node.fid === 0 ? 'default' : 'outline'}>{node.name}</Badge>
                  {#if node.status === 'pending_deletion'}
                    <Badge variant="warning" class="text-sm">Pending Deletion (Restorable)</Badge>
                  {:else if node.status === 'cleanup_in_progress'}
                    <span class="inline-flex items-center gap-1">
                      <Badge variant="destructive" class="text-sm">Deleting (No Recovery)</Badge>
                      <InfoTip text="Data cleanup is in progress. This fork cannot be restored." />
                    </span>
                  {/if}
                  {#if node.fid !== 0 && node.snapshotTs}
                    <span class="text-sm text-muted-foreground whitespace-nowrap">
                      snapshot of <span class="font-medium">{node.parentName}</span> @ <span class="font-mono">{formatTimestamp(node.snapshotTs / 1000)}</span>
                    </span>
                  {/if}
                  {#if node.size > 0}
                    <Badge variant="outline" class="text-sm px-1.5 py-0 font-mono">{formatBytes(node.size)}</Badge>
                  {/if}
                  {#if node.childrenCount > 0}
                    <Badge variant="secondary" class="text-sm px-1.5 py-0">{node.childrenCount}</Badge>
                  {/if}
                </div>
                {#if node.fid !== 0}
                  <div class="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                    {#if node.createdAt}
                      <span>created <span class="font-mono">{formatRelative(node.createdAt / 1_000_000)}</span></span>
                    {/if}
                    {#if node.createdBy}
                      <span>by {node.createdBy}</span>
                    {/if}
                    {#if node.inactiveAt}
                      <span class="text-warning">
                        deleted <span class="font-mono">{formatRelative(node.inactiveAt / 1_000_000)}</span>
                      </span>
                    {/if}
                  </div>
                {/if}
              </div>
              {#if node.fid !== 0 && canEdit && auth.can('volumes', 'delete')}
                <div class="flex items-center gap-1 shrink-0">
                  {#if node.status === 'active'}
                    <Button variant="ghost" size="sm" class="h-9 min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 px-3 text-xs text-destructive hover:text-destructive"
                      aria-label="Delete fork {node.name}"
                      onclick={() => confirmDeleteFork(node)}>
                      Delete
                    </Button>
                  {:else if node.status === 'pending_deletion'}
                    <Button variant="ghost" size="sm" class="h-9 min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 px-3 text-xs text-success hover:text-success"
                      aria-label="Restore fork {node.name}"
                      onclick={() => confirmRestoreFork(node)}>
                      Restore
                    </Button>
                  {/if}
                </div>
              {/if}
            </div>
            {#if node.children.length > 0}
              <div class="{depth > 0 && !isLast ? 'ml-5 border-l border-muted-foreground/20 pl-0' : depth > 0 ? 'ml-5' : ''}" role="group" aria-label="{node.name} children">
                {#each node.children as child, i}
                  {@render forkNode(child, depth + 1, i === node.children.length - 1)}
                {/each}
              </div>
            {/if}
          {/snippet}
          {@const tree = buildForkTree(forks)}
          <div role="tree" aria-label="Fork hierarchy">
            {#each tree as root, i}
              {@render forkNode(root, 0, i === tree.length - 1)}
            {/each}
          </div>
        {:else}
          {@const g = computeGraph(forks)}
          {@const svgW = G_LEFT + G_LABEL + G_TIMELINE + G_RIGHT}
          {@const svgH = G_TOP + g.totalRows * G_ROW + 8}
          <div class="overflow-x-auto -mx-2">
            <svg width={svgW} height={svgH} class="select-none" aria-label="Fork branch graph">
              {#each g.rows as br}
                {@const y = gRowY(br.row)}
                {@const startX = br.fid === 0 ? G_LEFT + G_LABEL : gTimeX(br.branchNorm)}
                <line x1={startX} y1={y} x2={gNowX} y2={y}
                  stroke={br.color} stroke-width="3" stroke-linecap="round"
                  opacity={br.status !== 'active' ? 0.35 : 1}
                  stroke-dasharray={br.status !== 'active' ? '6 4' : 'none'} />
                {#if br.status === 'active'}
                  <polygon points="{gNowX + 8},{y} {gNowX},{y - 4} {gNowX},{y + 4}" fill={br.color} />
                {:else}
                  <circle cx={gNowX} cy={y} r="3" fill={br.color} opacity="0.5" />
                {/if}
                {#if br.fid !== 0}
                  {@const bx = gTimeX(br.branchNorm)}
                  <path d={gBranchPath(br.parentRow, br.row, bx)}
                    fill="none" stroke={br.color} stroke-width="3" stroke-linecap="round"
                    opacity={br.status !== 'active' ? 0.35 : 1}
                    stroke-dasharray={br.status !== 'active' ? '6 4' : 'none'} />
                  <circle cx={bx} cy={gRowY(br.parentRow)} r="4"
                    fill={g.rowColorMap.get(br.parentRow) ?? 'var(--muted-foreground)'} stroke="var(--background)" stroke-width="2" />
                  <circle cx={bx} cy={y} r={G_DOT}
                    fill={br.color} stroke="var(--background)" stroke-width="2" />
                  {@const above = br.row < br.parentRow}
                  <text x={bx} y={above ? y - G_DOT - 6 : y + G_DOT + 16}
                    text-anchor="middle" dominant-baseline="auto"
                    fill={br.color} opacity="0.7"
                    class="font-mono text-sm">{formatShortDate(br.snapshotTs / 1000)}</text>
                {:else}
                  <circle cx={startX} cy={y} r={G_DOT + 1}
                    fill={br.color} stroke="var(--background)" stroke-width="2" />
                {/if}
                <text x={G_LEFT + G_LABEL - 12} y={y}
                  text-anchor="end" dominant-baseline="central"
                  fill={br.color}
                  class="font-semibold" style="font-size: 16px">{br.name}</text>
                {#if br.fid !== 0}
                  <text x={gNowX + 14} y={y}
                    dominant-baseline="central"
                    class="font-mono" style="font-size: 13px" fill="currentColor" opacity="0.55">{formatRelative(br.createdAt / 1_000_000)}{br.createdBy ? ` · ${br.createdBy}` : ''}{br.size > 0 ? ` · ${formatBytes(br.size)}` : ''}</text>
                {:else if br.size > 0}
                  <text x={gNowX + 14} y={y}
                    dominant-baseline="central"
                    class="font-mono" style="font-size: 13px" fill="currentColor" opacity="0.55">{formatBytes(br.size)}</text>
                {/if}
              {/each}
            </svg>
          </div>
        {/if}
      </CardContent>
    </Card>

    {#if auth.can('clientSessions', 'read')}
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle>Active Sessions ({sessionsTotal})</CardTitle>
            <Button variant="outline" size="sm" class="text-sm font-normal text-muted-foreground" href="/sessions?volumeId={id}">
              View all sessions
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {#if sessionsLoading && volSessions.length === 0}
            <TableSkeleton
              header={sessionsHeaderRow}
              caption="Loading active sessions"
              rows={3}
              cells={[
                { width: 'w-32' },
                { width: 'w-32', class: 'hidden md:table-cell' },
                { width: 'w-16', class: 'hidden lg:table-cell' },
                { width: 'w-16', height: 'h-5' },
                { width: 'w-20', class: 'hidden md:table-cell' },
                { width: 'w-20', class: 'hidden lg:table-cell' },
              ]}
            />
          {:else if volSessions.length === 0}
            <p class="text-sm text-muted-foreground">No active sessions</p>
          {:else}
            <Table containerLabel="Active sessions">
              <TableHeader>
                {@render sessionsHeaderRow()}
              </TableHeader>
              <TableBody>
                {#each volSessions as session}
                  {@const st = formatSessionStatus(session.status)}
                  <TableRow>
                    <TableCell class="text-sm">
                      <span class="font-medium">{formatClientType(session.clientType)}</span>
                      {#if session.osVersion}
                        <span class="text-muted-foreground ml-1">{session.osName} {session.osVersion}</span>
                      {/if}
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground hidden md:table-cell font-mono">
                      {session.hostname || session.ipAddr}
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">
                      {session.mountMode ?? '·'}
                    </TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell class="text-sm text-muted-foreground hidden md:table-cell">
                      {session.connectedAt ? formatDuration(session.connectedAt) : '·'}
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">
                      {session.lastHeartbeat ? formatRelative(session.lastHeartbeat) : '·'}
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
            {#if sessionsTotalPages > 1}
              <Pagination currentPage={sessionsPage} totalPages={sessionsTotalPages} onPageChange={(p) => fetchVolumeSessions(p)} />
            {/if}
          {/if}
        </CardContent>
      </Card>
    {/if}

    {#if volume.isActive && (auth.can('volumes', 'update') || auth.userMountosUserId != null)}
      <Separator />

      <Card>
        <CardHeader><CardTitle>API Keys</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          {#if auth.userMountosUserId != null}
            <fieldset class="space-y-3">
              <legend class="text-sm font-semibold">Generate API Keys</legend>
              <div class="flex items-end gap-3">
                <div class="w-full max-w-64 space-y-1">
                  <Label for="api-key-user">User</Label>
                  <Input id="api-key-user" value={auth.username ?? `User #${auth.userMountosUserId}`} readonly />
                </div>
                <Button size="sm" class="shrink-0" aria-describedby="api-key-user" onclick={generateKeys}>Generate</Button>
              </div>
            </fieldset>
          {/if}
          {#if auth.can('volumes', 'update')}
            {#if auth.userMountosUserId != null}<Separator />{/if}
            <div class="space-y-4 rounded-md bg-destructive/5 p-3">
              <fieldset class="space-y-3">
                <legend class="text-sm font-semibold">Revoke by User</legend>
                <div class="flex items-end gap-3">
                  <div class="w-full max-w-64 space-y-1">
                    <Label for="revoke-user-id">User</Label>
                    <Popover bind:open={userSelectOpen}>
                      <PopoverTrigger>
                        {#snippet child({ props })}
                          <Button {...props} id="revoke-user-id" variant="outline" role="combobox" aria-expanded={userSelectOpen}
                            class={cn("w-full justify-between font-normal", !revokeUserId && "text-muted-foreground")}>
                            {selectedUserLabel || 'Select user...'}
                            <ChevronsUpDown class="ml-auto h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        {/snippet}
                      </PopoverTrigger>
                      <PopoverContent class="w-[--bits-popover-anchor-width] p-0">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder="Search users..." bind:value={userSearchQuery} />
                          <CommandList>
                            {#if userSearchLoading}
                              <div class="flex items-center justify-center py-4">
                                <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            {:else if userOptions.length === 0}
                              <CommandEmpty>{userSearchQuery ? 'No users found.' : 'Type to search users...'}</CommandEmpty>
                            {:else}
                              {#each userOptions as user}
                                <CommandItem value={String(user.id)} onSelect={() => { revokeUserId = String(user.id); userSelectOpen = false }}>
                                  <Check class={cn("h-4 w-4", revokeUserId === String(user.id) ? "opacity-100" : "opacity-0")} />
                                  <span>{user.username}</span>
                                  <span class="ml-auto text-xs text-muted-foreground">{user.email}</span>
                                </CommandItem>
                              {/each}
                            {/if}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button variant="destructive" size="sm" class="shrink-0" disabled={!revokeUserId} onclick={handleRevokeKeysByUser}>Revoke</Button>
                </div>
              </fieldset>
              <Separator class="opacity-50" />
              <fieldset class="space-y-3">
                <legend class="text-sm font-semibold">Revoke API Key</legend>
                <div class="flex items-end gap-3">
                  <div class="w-full max-w-64 space-y-1">
                    <Label for="revoke-key-id">API Key</Label>
                    <Input id="revoke-key-id" bind:value={revokeKey} placeholder="API key to revoke" />
                  </div>
                  <Button variant="destructive" size="sm" class="shrink-0" disabled={!revokeKey} onclick={handleRevokeKey}>Revoke</Button>
                </div>
              </fieldset>
            </div>
          {/if}
        </CardContent>
      </Card>
    {/if}
  {:else}
    <p class="text-muted-foreground">Volume not found.</p>
  {/if}
</div>
<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} onConfirm={dialog.action} />
{#if volume}
  <DeactivateVolumeDialog bind:open={deactivateOpen} volumeName={volume.name} onConfirm={handleDeactivate} />
{/if}

<Dialog.Root bind:open={deleteForkOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Delete Fork</Dialog.Title>
      <Dialog.Description>
        {#if deleteForkTarget}
          {#if deleteForkForce}
            <div class="flex items-center gap-2 mt-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
              <ShieldAlert class="h-4 w-4 shrink-0" />
              <span>Force delete: also removes {deleteForkTarget.children.length} child fork{deleteForkTarget.children.length !== 1 ? 's' : ''}: <strong>{deleteForkTarget.children.map(c => c.name).join(', ')}</strong></span>
            </div>
          {/if}
          <p class="mt-2 text-sm">
            Fork <span class="font-semibold">{deleteForkTarget.name}</span> will be marked for deletion.
            Data cleanup starts after the grace period. You can restore during this window.
          </p>
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => deleteForkOpen = false}>Cancel</Button>
      <Button variant="destructive" disabled={deleteForkLoading} onclick={handleDeleteFork}>
        {#if deleteForkLoading}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
        {/if}
        {deleteForkForce ? 'Force Delete' : 'Delete'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={restoreForkOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Restore Fork</Dialog.Title>
      <Dialog.Description>
        {#if restoreForkTarget}
          <p class="mt-2 text-sm">
            Restore fork <span class="font-semibold">{restoreForkTarget.name}</span>? This will make it active again and allow client connections.
          </p>
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => restoreForkOpen = false}>Cancel</Button>
      <Button variant="default" disabled={restoreForkLoading} onclick={handleRestoreFork}>
        {#if restoreForkLoading}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
        {/if}
        Restore
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={createForkOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Create Fork</Dialog.Title>
      <Dialog.Description>
        <p class="mt-2 text-sm">Snapshot the parent fork at the current moment, or rewind to a past point within the volume's retention window.</p>
      </Dialog.Description>
    </Dialog.Header>
    <div class="space-y-4 py-2">
      <div class="space-y-1.5">
        <Label for="create-fork-name" class="text-sm font-semibold">Name</Label>
        <Input id="create-fork-name" bind:value={createForkName} placeholder="lowercase-with-hyphens" />
        {#if createForkNameError}
          <p class="text-xs text-destructive">{createForkNameError}</p>
        {:else if createForkNameChanged}
          <p class="text-xs text-muted-foreground">
            Will be saved as
            <button
              type="button"
              class="font-mono text-foreground underline-offset-2 hover:underline"
              onclick={() => createForkName = createForkSanitized}
            >{createForkSanitized}</button>
          </p>
        {:else}
          <p class="text-xs text-muted-foreground">3–63 chars · lowercase letters, digits, <code>.</code> <code>-</code> · start/end alphanumeric</p>
        {/if}
      </div>
      <div class="space-y-1.5">
        <Label for="create-fork-parent" class="text-sm font-semibold">Parent Fork</Label>
        <Select id="create-fork-parent" bind:value={createForkParent}
          options={forkParentOptions} placeholder="Select parent fork" />
      </div>
      <div class="space-y-1.5">
        <div class="flex items-center gap-2">
          <Checkbox id="create-fork-asof" bind:checked={createForkAsOfEnabled} />
          <Label for="create-fork-asof" class="text-sm inline-flex items-center gap-1">
            Snapshot at past time
            <InfoTip text={"Off: snapshot the parent now.\nOn: snapshot at the chosen UTC timestamp. Reachable back to (now − retention), extended further if an existing fork's snapshot pins older data."} />
          </Label>
        </div>
        {#if createForkAsOfEnabled}
          <DateTimePicker
            id="create-fork-asof-input"
            bind:value={createForkAsOfLocal}
            min={createForkAsOfMin}
            max={createForkAsOfMax}
          />
        {/if}
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => createForkOpen = false}>Cancel</Button>
      <Button
        variant="default"
        disabled={createForkLoading || !createForkSanitized || !!createForkNameError || (createForkAsOfEnabled && !createForkAsOfLocal)}
        onclick={handleCreateFork}
      >
        {#if createForkLoading}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
        {/if}
        Create
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={credentialsOpen}>
  <Dialog.Content class="cyberpunk-skewed sm:max-w-lg p-0 gap-0 border-none"
    showCloseButton={false}
    interactOutsideBehavior="ignore"
    escapeKeydownBehavior="ignore">
    <div class="cyberpunk-skewed-inner flex flex-col gap-4">
      <div class="flex items-start gap-3">
        <ShieldAlert class="size-5 shrink-0 text-warning mt-0.5" />
        <div class="flex flex-col gap-1">
          <Dialog.Title class="text-base font-semibold tracking-tight">API Credentials Generated</Dialog.Title>
          <Dialog.Description class="text-sm text-muted-foreground leading-relaxed">
            Copy and save these credentials now. They will not be shown again.
          </Dialog.Description>
        </div>
      </div>
      {#if genResult}
        <div class="space-y-3">
          <div class="space-y-1">
            <span class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">API Key</span>
            <div class="flex items-center gap-2">
              <code class="flex-1 font-mono text-sm break-all bg-muted/50 rounded-sm px-2.5 py-1.5 border select-all">{genResult.apiKey}</code>
              <button type="button"
                class="shrink-0 size-11 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                onclick={() => copyToClipboard(genResult!.apiKey, 'key')} aria-label="Copy API key">
                {#if copiedField === 'key'}<Check class="size-4 text-success" />{:else}<Copy class="size-4" />{/if}
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <span class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">API Secret</span>
            <div class="flex items-center gap-2">
              <code class="flex-1 font-mono text-sm break-all bg-muted/50 rounded-sm px-2.5 py-1.5 border select-all">{genResult.apiSecret}</code>
              <button type="button"
                class="shrink-0 size-11 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                onclick={() => copyToClipboard(genResult!.apiSecret, 'secret')} aria-label="Copy API secret">
                {#if copiedField === 'secret'}<Check class="size-4 text-success" />{:else}<Copy class="size-4" />{/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
      <div class="pt-2 flex justify-end">
        <Button variant="primary" class="cyberpunk-skewed-sm" onclick={closeCredentials}>Done</Button>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
