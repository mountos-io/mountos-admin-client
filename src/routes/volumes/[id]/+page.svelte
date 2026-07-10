<script lang="ts">
  import { onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
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
  import { toDatetimeTz, parseDatetimeTz, forkAsOfMin, forkAsOfMax, gcFloorMs } from '$lib/core/utils/forkRetention'
  import { tz } from '$lib/core/stores/tz.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import { api } from '$lib/core/stores/client.svelte'
  import { userCache } from '$lib/core/stores/user-cache.svelte'
  import type { Volume, User, DeactivateVolumeRequest, ClientSession, Fork, CreateVolumeForkRequest, VolumeSizePoint, VolumeApiKey } from '$lib/core/api/types'
  import VolumeSizeHistoryChart from '$lib/components/shared/VolumeSizeHistoryChart.svelte'
  import { handleApiError, showErrorToast, showSuccessToast } from '$lib/core/utils/toast'
  import { copyText } from '$lib/core/utils/clipboard'
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
  import KeyRound from '@lucide/svelte/icons/key-round'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import X from '@lucide/svelte/icons/x'
  import ShieldAlert from '@lucide/svelte/icons/shield-alert'
  import GitFork from '@lucide/svelte/icons/git-fork'
  import ForkPicker from '$lib/components/volume-tree/ForkPicker.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import DateTimePicker from '$lib/components/shared/DateTimePicker.svelte'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import { sanitizeForkName, forkNameErrorMessage } from '$lib/core/utils/validation'

  const store = useVolumes()
  const clusterStore = useClusters()
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
  let moveClusterOpen = $state(false)
  let moveClusterSubmitting = $state(false)
  let moveTargetClusterId = $state('')

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

  function openCreateFork() {
    createForkName = ''
    createForkParent = 'main'
    createForkAsOfEnabled = false
    createForkAsOfLocal = toDatetimeTz(new Date(), tz.value)
    createForkOpen = true
  }

  const createForkSanitized = $derived(sanitizeForkName(createForkName.trim()))
  const createForkNameError = $derived.by(() => {
    const raw = createForkName.trim()
    if (!raw) return ''
    const sanitized = createForkSanitized
    const sanitizedClean = !!sanitized && !forkNameErrorMessage(sanitized)
    const sanitizedExists = sanitizedClean && forks.some(f => f.name === sanitized)
    const rawErr = forkNameErrorMessage(raw)
    if (rawErr) {
      // Defer to the "Use <sanitized>" suggestion when sanitization yields
      // a clean, non-colliding name; otherwise surface the raw error so
      // issues like a trailing '-' aren't masked by a duplicate check
      // against the silently-sanitized form.
      if (sanitizedClean && sanitized !== raw && !sanitizedExists) return ''
      return rawErr
    }
    if (forks.some(f => f.name === sanitized)) {
      return `Fork "${sanitized}" already exists`
    }
    return ''
  })
  const createForkNameChanged = $derived(
    createForkName.trim().length > 0 && createForkSanitized !== createForkName.trim()
  )

  async function handleCreateFork() {
    if (!volume) return
    const finalName = createForkSanitized
    // Use the derived error (includes duplicate-name check) to close the
    // race where forks refresh between derived recompute and submit.
    if (!finalName || createForkNameError) return
    if (createForkAsOfEnabled && !createForkAsOfLocal) return
    createForkLoading = true
    try {
      const req: CreateVolumeForkRequest = { name: finalName }
      if (createForkParent && createForkParent !== 'main') req.parentName = createForkParent
      if (createForkAsOfEnabled) {
        req.asOf = parseDatetimeTz(createForkAsOfLocal, tz.value) * 1000
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
  let genResult = $state<{ apiKey: string; apiSecret: string; evictedApiKeys?: string[] } | null>(null)
  let credentialsOpen = $state(false)

  const API_KEY_LIMIT = 2
  let apiKeys = $state<VolumeApiKey[]>([])
  let apiKeysLoading = $state(false)
  // False until a list succeeds; an unknown key set makes generateKeys confirm.
  let apiKeysKnown = $state(false)
  let apiKeysCtrl: AbortController | null = null

  async function fetchApiKeys() {
    // Listing needs a linked mountOS user (403 otherwise) and an active volume
    if (auth.userMountosUserId == null || !volume?.isActive) return
    apiKeysCtrl?.abort()
    const ctrl = apiKeysCtrl = new AbortController()
    apiKeysLoading = true
    try {
      // Oldest first (server orders by creation time)
      const keys = (await store.listApiKeys(id, ctrl.signal)).keys ?? []
      if (ctrl.signal.aborted) return
      apiKeys = keys
      apiKeysKnown = true
    } catch (e) {
      if (ctrl.signal.aborted || (e as Error).name === 'AbortError') return
      // Keep any stale list; the inline error state below reports the failure
      // (the api client already toasts 5xx, so no extra toast here)
      apiKeysKnown = false
    } finally {
      if (apiKeysCtrl === ctrl) apiKeysLoading = false
    }
  }

  function keyLabel(k: VolumeApiKey) {
    return k.name || `${k.apiKey.slice(0, 6)}…`
  }
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
  let editForkGrace = $state('')
  let editEventLog = $state('')
  let editQuota = $state('')
  let editSaving = $state(false)

  const editDirty = $derived(
    volume != null && (
      editDesc !== (volume.description ?? '') ||
      editRetention !== String(volume.retentionPeriod) ||
      editGrace !== String(volume.gracePeriod) ||
      editForkGrace !== String(volume.forkGracePeriod) ||
      editEventLog !== String(volume.eventLogRetentionPeriod) ||
      editQuota !== String(bytesToGb(volume.quotaLimit))
    )
  )

  function syncEditFields(v: Volume) {
    editDesc = v.description ?? ''
    editRetention = String(v.retentionPeriod)
    editGrace = String(v.gracePeriod)
    editForkGrace = String(v.forkGracePeriod)
    editEventLog = String(v.eventLogRetentionPeriod)
    editQuota = String(bytesToGb(v.quotaLimit))
  }

  let volFetchCtrl: AbortController | undefined
  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    volFetchCtrl?.abort()
    volFetchCtrl = new AbortController()
    const ctrl = volFetchCtrl
    volSessions = []; sessionsTotal = 0; sessionsTotalPages = 0; sessionsPage = 1
    apiKeysCtrl?.abort(); apiKeys = []; apiKeysKnown = false; newKeyName = ''
    loading = true
    store.getVolume(id).then(v => {
      if (ctrl.signal.aborted) return
      volume = v
      syncEditFields(v)
      fetchVolumeSessions()
      fetchForks()
      fetchApiKeys()
    }).catch(() => { if (!ctrl.signal.aborted) volume = null }).finally(() => { if (!ctrl.signal.aborted) loading = false })
  })

  onDestroy(() => { volFetchCtrl?.abort(); sessionsCtrl?.abort(); sizeCtrl?.abort(); apiKeysCtrl?.abort() })

  async function reload() {
    const v = await store.getVolume(id)
    volume = v
    syncEditFields(v)
  }

  // Lazily load the region's clusters when the move modal opens, so the
  // dropdown is populated even for volumes the operator hasn't browsed via
  // the region detail page yet.
  $effect(() => {
    if (moveClusterOpen && volume?.region?.id) {
      clusterStore.fetchClusters(volume.region.id)
    }
  })

  const moveClusterCandidates = $derived(
    volume?.region?.id
      ? clusterStore.clustersFor(volume.region.id).filter(c =>
          c.isActive && c.isReady && c.id !== (volume?.regionCluster?.id ?? 0))
      : [],
  )

  async function submitMoveCluster() {
    if (!volume || !moveTargetClusterId) return
    moveClusterSubmitting = true
    try {
      const res = await api.volumes.moveCluster(id, { targetClusterId: Number(moveTargetClusterId) })
      const min = Math.max(0, Math.round((res.handoverUntil * 1000 - Date.now()) / 60000))
      showSuccessToast(`Move committed; old cluster keeps serving for ~${min}m`)
      moveClusterOpen = false
      moveTargetClusterId = ''
      await reload()
    } catch (e) {
      handleApiError(e, 'Failed to move cluster')
    } finally {
      moveClusterSubmitting = false
    }
  }

  function cancelEdit() {
    if (volume) syncEditFields(volume)
    editing = false
  }

  async function saveEdit() {
    if (!volume) return
    editSaving = true
    try {
      const isAdmin = !auth.isUserRole
      const quotaChanged = isAdmin && editQuota !== String(bytesToGb(volume.quotaLimit))
      await store.editVolume(id, {
        description: editDesc.trim() || undefined,
        retentionPeriod: editRetention ? Number(editRetention) : undefined,
        forkGracePeriod: editForkGrace ? Number(editForkGrace) : undefined,
        eventLogRetentionPeriod: editEventLog ? Number(editEventLog) : undefined,
        gracePeriod: isAdmin && editGrace ? Number(editGrace) : undefined,
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

  let newKeyName = $state('')

  function generateKeys() {
    const userId = auth.userMountosUserId
    if (userId == null) return
    const doGenerate = async () => {
      try {
        genResult = await store.generateApiKeys(id, { userId, name: newKeyName.trim() || undefined })
        credentialsOpen = true
        newKeyName = ''
        await fetchApiKeys()
      } catch (e: unknown) { handleApiError(e, 'Failed to generate token') }
    }
    if (apiKeys.length >= API_KEY_LIMIT) {
      const oldest = apiKeys[0]
      dialog.confirm(
        'Generate API Token',
        `You already have ${API_KEY_LIMIT} active API keys on this volume. Generating a new one revokes your oldest key (${keyLabel(oldest)}). Anything currently mounted with that key will lose access.`,
        doGenerate,
        'destructive',
      )
    } else if (!apiKeysKnown) {
      // Key list unknown (load failed): warn as if at the limit.
      dialog.confirm(
        'Generate API Token',
        `Your current keys could not be loaded. If you already have ${API_KEY_LIMIT} active keys on this volume, generating a new one revokes the oldest; anything mounted with it will lose access.`,
        doGenerate,
        'destructive',
      )
    } else {
      void doGenerate()
    }
  }

  function closeCredentials() {
    credentialsOpen = false
    genResult = null
  }

  let copiedField = $state<string | null>(null)
  async function copyToClipboard(text: string, field: string) {
    if (await copyText(text)) {
      copiedField = field
      setTimeout(() => { if (copiedField === field) copiedField = null }, 1500)
    } else {
      showErrorToast('Failed to copy')
    }
  }

  function handleRevokeKey(key = revokeKey, label = '') {
    if (!key) return
    dialog.confirm('Revoke API Key', `Revoke key "${label || key}"? Anything currently mounted with it will lose access.`, async () => {
      await store.revokeApiKey(id, key)
      if (key === revokeKey) revokeKey = ''
      showSuccessToast('API key revoked')
      await fetchApiKeys()
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
        userId: auth.isUserRole ? (auth.userMountosUserId ?? undefined) : undefined,
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

  const createForkAsOfMin = $derived(forkAsOfMin(volume, forks, createForkParent, tz.value))
  const createForkAsOfMax = $derived(forkAsOfMax(tz.value))

  type VolumeTabId = 'overview' | 'browse' | 'forks' | 'sessions' | 'apikeys'
  const TAB_IDS: ReadonlyArray<VolumeTabId> = ['overview', 'browse', 'forks', 'sessions', 'apikeys']
  const activeTab = $derived.by<VolumeTabId>(() => {
    const v = $page.url.searchParams.get('tab') ?? ''
    return (TAB_IDS as ReadonlyArray<string>).includes(v) ? (v as VolumeTabId) : 'overview'
  })
  function setTab(t: VolumeTabId) {
    const sp = new URLSearchParams($page.url.searchParams)
    if (t === 'overview') sp.delete('tab')
    else sp.set('tab', t)
    const qs = sp.toString()
    goto(qs ? `?${qs}` : window.location.pathname, { replaceState: true, noScroll: true, keepFocus: true })
  }
  function handleTabKey(e: KeyboardEvent, current: VolumeTabId) {
    let next: VolumeTabId | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = TAB_IDS[(TAB_IDS.indexOf(current) + 1) % TAB_IDS.length]
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = TAB_IDS[(TAB_IDS.indexOf(current) - 1 + TAB_IDS.length) % TAB_IDS.length]
    } else if (e.key === 'Home') {
      next = TAB_IDS[0]
    } else if (e.key === 'End') {
      next = TAB_IDS[TAB_IDS.length - 1]
    }
    if (!next) return
    e.preventDefault()
    setTab(next)
    const targetId = `volume-tab-${next}`
    requestAnimationFrame(() => document.getElementById(targetId)?.focus())
  }

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

  const forkParentOptions = $derived([
    { value: 'main', label: 'main' },
    ...forks.filter(f => f.status === 'active' && f.name !== 'main').map(f => ({ value: f.name, label: f.name })),
  ])

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
    createdBy?: number; color: string; status: string; size: number
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

  const forkTree = $derived(buildForkTree(forks))
  const forkGraph = $derived.by(() => computeGraph(forks))

  function handleRevokeKeysByUser() {
    const uid = Number(revokeUserId)
    if (!revokeUserId || Number.isNaN(uid)) return
    const label = selectedUserLabel || `User #${uid}`
    dialog.confirm('Revoke Key', `Revoke API key for ${label}?`, async () => {
      await store.revokeApiKeysByUser({ volumeId: id, userId: uid })
      showSuccessToast(`API key revoked for ${label}`)
      await fetchApiKeys()
    }, 'destructive')
  }
</script>

<svelte:head>
  <title>{volume?.name ?? 'Volume'} · mountOS Admin</title>
</svelte:head>

{#snippet apiKeysHeaderRow()}
  <TableRow>
    <TableHead class="th-cyber">Name</TableHead>
    <TableHead class="th-cyber">Key</TableHead>
    <TableHead class="th-cyber hidden sm:table-cell">Created</TableHead>
    <TableHead class="th-cyber">Last used</TableHead>
    <TableHead class="th-cyber w-20"><span class="sr-only">Actions</span></TableHead>
  </TableRow>
{/snippet}

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
    <Button variant="ghost" size="sm" href="/volumes" class="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" aria-label="Back to volumes"><ArrowLeft class="h-4 w-4" /></Button>
    <h1 class="text-2xl font-bold tracking-tight min-w-0 truncate">{volume?.name ?? 'Volume'}</h1>
    {#if volume}
      <Badge variant="outline" style="border-color: var(--pastel-volume); color: var(--pastel-volume-text)">Volume</Badge>
      <Badge variant={volume.volumeType === 'iceberg' ? 'primary' : 'secondary'} class="capitalize" aria-label="Volume type {volume.volumeType}">{volume.volumeType}</Badge>
    {/if}
  </div>
  {#if volume}
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div role="tablist" aria-label="Volume sections" class="relative border border-border/30 rounded-sm px-2 py-1 max-w-full overflow-x-auto">
        <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
        <div class="relative flex items-center gap-1 whitespace-nowrap">
          {#each [
            ['overview', 'Overview', 'Overview'],
            ['browse', 'Browse', 'Browse'],
            ['forks', 'Forks', 'Forks'],
            ['sessions', 'Active Sessions', 'Sessions'],
            ['apikeys', 'API Keys', 'Keys'],
          ] as [id, label, shortLabel]}
            <Button variant={activeTab === id ? 'primary' : 'ghost'} size="sm"
              class="h-7 min-h-[44px] sm:min-h-7 px-3 text-xs font-mono justify-center"
              id="volume-tab-{id}" role="tab"
              aria-selected={activeTab === id}
              aria-controls="volume-tabpanel-{id}"
              aria-label={label}
              tabindex={activeTab === id ? 0 : -1}
              onkeydown={(e: KeyboardEvent) => handleTabKey(e, id as VolumeTabId)}
              onclick={() => setTab(id as VolumeTabId)}>
              <span class="hidden sm:inline">{label}</span>
              <span class="sm:hidden">{shortLabel}</span>
            </Button>
          {/each}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        {#if volume?.isActive}
          <Button variant="outline" size="sm"
            onclick={generateKeys}
            title="Generate an API token for your account on this volume"
            class="gap-1.5 min-h-[44px] sm:min-h-9">
            <KeyRound class="size-3.5" aria-hidden="true" />
            <span>Generate API token</span>
          </Button>
        {/if}
        {#if canEdit}
          <button type="button"
            onclick={openCreateFork}
            title="Create a new fork from this volume"
            class="cyberpunk-skewed-sm group inline-flex items-center gap-2 h-9 min-h-[44px] sm:min-h-9 px-4 bg-primary/10 text-primary font-mono text-xs uppercase tracking-[0.18em] transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Plus class="h-3.5 w-3.5" aria-hidden="true" />
            <span>New Fork</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}
  {#if loading}
    <DetailSkeleton cards={[{ rows: 5, cols: 1 }]} />
  {:else if volume && activeTab === 'browse'}
    <div role="tabpanel" id="volume-tabpanel-browse" aria-labelledby="volume-tab-browse" tabindex={-1}>
      {#await import('$lib/components/volume-tree/TreeTab.svelte') then { default: TreeTab }}
        <TreeTab volumeId={id} {volume} {forks} />
      {/await}
    </div>
  {:else if volume && activeTab === 'overview'}
    <div role="tabpanel" id="volume-tabpanel-overview" aria-labelledby="volume-tab-overview" tabindex={-1} class="space-y-6">
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
            {#if volume.region?.id}
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Region</span>
                <div class="mt-1">
                  <a
                    href="/regions/{volume.region.id}"
                    aria-label="View region {volume.region.name} details"
                    class="text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >{volume.region.name}</a>
                </div>
              </div>
            {/if}
            {#if volume.regionCluster?.id}
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Cluster</span>
                <div class="mt-1">
                  <a
                    href="/regions/{volume.region.id}?cluster={volume.regionCluster.id}"
                    aria-label="View region {volume.region.name} scoped to cluster {volume.regionCluster.name}"
                    class="text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >{volume.regionCluster.name}</a>
                </div>
              </div>
            {/if}
            {#if volume.storage?.id}
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Storage</span>
                <div class="mt-1">
                  <a
                    href="/storages/{volume.storage.id}"
                    aria-label="View storage {volume.storage.name} details"
                    class="text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >{volume.storage.name}</a>
                </div>
              </div>
            {/if}
          </div>
          {#if editing}
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-1.5">
                <FieldLabel for="edit-retention" tooltip="Number of days back snapshot traversal can reach. Beyond this window, snapshot mounts may show inconsistent data due to cleaned-up data. An active fork pinning older data may force retention beyond the configured window." class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                  Day Retention Window (days)
                </FieldLabel>
                <Input id="edit-retention" type="number" bind:value={editRetention} placeholder="30" min="0" max="366" />
              </div>
              {#if !auth.isUserRole}
                <div class="space-y-1.5">
                  <FieldLabel for="edit-grace" tooltip="After deactivation, this is the window to reactivate the volume. Once it expires, data is purged according to the cleanup options chosen at deactivation." class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                    Grace Period (days)
                  </FieldLabel>
                  <Input id="edit-grace" type="number" bind:value={editGrace} placeholder="14" min="0" max="91" />
                </div>
              {/if}
              <div class="space-y-1.5">
                <FieldLabel for="edit-fork-grace" tooltip="After a named fork is deactivated, the window to restore it before its data is permanently cleaned up." class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                  Fork Grace Period (days)
                </FieldLabel>
                <Input id="edit-fork-grace" type="number" bind:value={editForkGrace} placeholder="1" min="0" max="30" />
              </div>
              <div class="space-y-1.5">
                <FieldLabel for="edit-event-log" tooltip="How many days of file/folder change events are kept for this volume. 0 disables change-event logging (saves resources)." class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                  Event Log Retention (days)
                </FieldLabel>
                <Input id="edit-event-log" type="number" bind:value={editEventLog} placeholder="0" min="0" max="30" />
              </div>
            </div>
          {:else}
            <div class="flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Day Retention Window
                  <InfoTip text={"Number of days back snapshot traversal can reach.\n\nAn active fork pinning older data may force the effective retention beyond the configured window."} />
                </span>
                <p class="text-sm">{volume.retentionPeriod} days</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Grace Period
                  <InfoTip text={"After deactivation, this is the window to reactivate the volume.\n\nOnce it expires, data is purged according to the cleanup options chosen at deactivation."} />
                </span>
                <p class="text-sm">{volume.gracePeriod} days</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Fork Grace Period
                  <InfoTip text="After a named fork is deactivated, the window to restore it before its data is permanently cleaned up." />
                </span>
                <p class="text-sm">{volume.forkGracePeriod} days</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Event Log Retention
                  <InfoTip text="How many days of file/folder change events are kept for this volume. 0 disables change-event logging (saves resources)." />
                </span>
                <p class="text-sm">{volume.eventLogRetentionPeriod} days</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Retention up to
                  <InfoTip text={"Earliest snapshot reachable: today minus the retention window, or the oldest active fork's snapshot, whichever is older."} />
                </span>
                <p class="text-sm">{formatTimestamp(gcFloorMs(volume, forks))}</p>
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
          {#if editing && !auth.isUserRole}
            <div class="space-y-1.5">
              <Label for="edit-quota" class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Quota Limit (GB)</Label>
              <Input id="edit-quota" type="number" bind:value={editQuota} placeholder="0 = unlimited" min="0" step="0.01" />
            </div>
          {:else if !editing}
            <div class="flex flex-wrap gap-x-6 gap-y-2">
              <div class="min-w-[16rem]">
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Quota
                </span>
                <p class="mt-1 font-mono text-sm">{formatQuota(volume.totalVolume, volume.quotaLimit)}</p>
                {#if volume.quotaLimit > 0}
                  {@const pct = quotaPercent(volume.totalVolume, volume.quotaLimit)}
                  <div class="mt-1.5 h-1.5 w-full rounded-sm bg-muted overflow-hidden" role="progressbar"
                    aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                    aria-label="Quota usage {pct}%">
                    <div class="h-full rounded-sm transition-transform origin-left {pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-warning' : 'bg-primary'}" style="transform: scaleX({pct / 100})"></div>
                  </div>
                {/if}
              </div>
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
                  <InfoTip text={"Object / block storage space used.\n\nIncludes all versions and yet-to-be-discarded file segments, plus in-flight multipart uploads."} />
                </span>
                <p class="mt-1 font-mono text-sm">{formatBytes(volume.totalVolume)}</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Pending
                  <InfoTip text={"In-flight multipart uploads not yet completed or aborted."} />
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
            {#if !auth.isUserRole}
              <Button variant="outline" size="sm" onclick={() => { moveClusterOpen = true }}>Move Cluster</Button>
            {/if}
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
    </div>
  {:else if volume && activeTab === 'forks'}
    <div role="tabpanel" id="volume-tabpanel-forks" aria-labelledby="volume-tab-forks" tabindex={-1}>
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
                    <Badge variant="secondary" class="text-sm px-1.5 py-0 inline-flex items-center gap-1"
                      aria-label="{node.childrenCount} child fork{node.childrenCount === 1 ? '' : 's'}"
                      title="{node.childrenCount} child fork{node.childrenCount === 1 ? '' : 's'}">
                      <GitFork class="size-3" aria-hidden="true" />
                      {node.childrenCount}
                    </Badge>
                  {/if}
                </div>
                {#if node.fid !== 0}
                  <div class="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                    {#if node.createdAt}
                      <span>created <span class="font-mono">{formatRelative(node.createdAt / 1_000_000)}</span></span>
                    {/if}
                    {#if node.createdBy}
                      <span title={`user#${node.createdBy}`}>by {void userCache.rev, userCache.display(node.createdBy)}</span>
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
          {@const tree = forkTree}
          <div role="tree" aria-label="Fork hierarchy">
            {#each tree as root, i}
              {@render forkNode(root, 0, i === tree.length - 1)}
            {/each}
          </div>
        {:else}
          {@const g = forkGraph}
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
                    class="font-mono" style="font-size: 13px" fill="currentColor" opacity="0.55">{formatRelative(br.createdAt / 1_000_000)}{br.createdBy ? ` · ${(void userCache.rev, userCache.display(br.createdBy))}` : ''}{br.size > 0 ? ` · ${formatBytes(br.size)}` : ''}</text>
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
    </div>
  {:else if volume && activeTab === 'sessions'}
    <div role="tabpanel" id="volume-tabpanel-sessions" aria-labelledby="volume-tab-sessions" tabindex={-1}>
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
                {#each volSessions as session (session.id)}
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
    {:else}
      <EmptyState title="Sessions restricted" description="Your role does not allow viewing client sessions for this volume." />
    {/if}
    </div>
  {:else if volume && activeTab === 'apikeys'}
    <div role="tabpanel" id="volume-tabpanel-apikeys" aria-labelledby="volume-tab-apikeys" tabindex={-1}>
    {#if volume.isActive}
      <Card>
        <CardHeader><CardTitle>API Keys</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <fieldset class="space-y-3">
            <legend class="text-sm font-semibold">Your API keys</legend>
            {#if apiKeysLoading}
              <TableSkeleton rows={2} caption="Loading API keys" header={apiKeysHeaderRow}
                cells={[{ width: 'w-20' }, { width: 'w-40' }, { width: 'w-24', class: 'hidden sm:table-cell' }, { width: 'w-24' }, { width: 'w-16' }]} />
            {:else if auth.userMountosUserId == null}
              <p class="text-sm text-muted-foreground">Your dashboard account has no linked mountOS user, so it holds no API keys.</p>
            {:else if !apiKeysKnown}
              <div class="flex items-center gap-3">
                <p class="text-sm text-destructive">Could not load your API keys.</p>
                <Button variant="outline" size="sm" onclick={fetchApiKeys}>Retry</Button>
              </div>
            {:else if apiKeys.length === 0}
              <p class="text-sm text-muted-foreground">No active keys for your account on this volume.</p>
            {:else}
              <Table containerLabel="Your API keys">
                <TableHeader>
                  {@render apiKeysHeaderRow()}
                </TableHeader>
                <TableBody>
                  {#each apiKeys as k (k.apiKey)}
                    <TableRow>
                      <TableCell class="font-medium">{k.name || '·'}</TableCell>
                      <TableCell><code class="font-mono text-xs">{k.apiKey}</code></TableCell>
                      <TableCell class="hidden sm:table-cell text-muted-foreground" title={k.createdAt}>{k.createdAt ? formatRelative(k.createdAt) : '·'}</TableCell>
                      <TableCell class="text-muted-foreground" title={k.lastUsedAt}>{k.lastUsedAt ? formatRelative(k.lastUsedAt) : 'never'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" class="h-9 min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 px-3 text-xs text-destructive hover:text-destructive"
                          onclick={() => handleRevokeKey(k.apiKey, keyLabel(k))}>Revoke</Button>
                      </TableCell>
                    </TableRow>
                  {/each}
                </TableBody>
              </Table>
              <p class="text-xs text-muted-foreground">Last used advances on authentication events and may lag actual use by up to an hour.</p>
            {/if}
          </fieldset>
          <Separator />
          <fieldset class="space-y-3">
            <legend class="text-sm font-semibold">Generate an API token</legend>
            <div class="flex items-end gap-3 flex-wrap">
              <div class="w-full max-w-64 space-y-1">
                <Label for="api-key-user">User</Label>
                <Input id="api-key-user" value={auth.username ?? auth.user?.name ?? 'current session'} readonly />
              </div>
              <div class="w-full max-w-64 space-y-1">
                <Label for="api-key-name">Key name (optional)</Label>
                <Input id="api-key-name" bind:value={newKeyName} maxlength={64} placeholder="e.g. laptop, ci-runner" />
              </div>
              <Button size="sm" class="shrink-0" aria-describedby="api-key-user" disabled={auth.userMountosUserId == null} onclick={generateKeys}>Generate</Button>
            </div>
            {#if auth.userMountosUserId == null}
              <p class="text-xs text-muted-foreground">Your dashboard account has no linked mountOS user, so it cannot generate API keys.</p>
            {:else}
              <p class="text-xs text-muted-foreground">Mints an access key and secret pair bound to your logged-in account. Up to {API_KEY_LIMIT} keys can be active at once; generating another revokes your oldest key.</p>
            {/if}
          </fieldset>
          {#if auth.can('volumes', 'update') && !auth.isUserRole}
            <Separator />
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
                  <Button variant="destructive" size="sm" class="shrink-0" disabled={!revokeKey} onclick={() => handleRevokeKey()}>Revoke</Button>
                </div>
              </fieldset>
            </div>
          {/if}
        </CardContent>
      </Card>
    {:else if !volume.isActive}
      <EmptyState title="Volume deactivated" description="API tokens cannot be generated or rotated while the volume is deactivated." />
    {:else}
      <EmptyState title="API tokens restricted" description="Your role does not allow managing API tokens for this volume." />
    {/if}
    </div>
  {:else if volume}
    <div role="tabpanel" id="volume-tabpanel-overview" aria-labelledby="volume-tab-overview" tabindex={-1}>
      <p class="text-sm text-muted-foreground">Unknown tab.</p>
    </div>
  {:else}
    <p class="text-muted-foreground">Volume not found.</p>
  {/if}
</div>
<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} onConfirm={dialog.action} />
{#if volume}
  <DeactivateVolumeDialog bind:open={deactivateOpen} volumeName={volume.name} onConfirm={handleDeactivate} />
{/if}

<Dialog.Root bind:open={moveClusterOpen} onOpenChange={(v) => { if (!v) moveTargetClusterId = '' }}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Move volume to another cluster</Dialog.Title>
      <Dialog.Description>
        The old cluster keeps serving briefly so live clients re-resolve cheaply.
        A volume can only be moved once every 15 minutes; earlier attempts are rejected.
      </Dialog.Description>
    </Dialog.Header>
    {#if moveClusterCandidates.length === 0}
      <p class="text-muted-foreground text-base">No other ready clusters available in this region.</p>
    {:else}
      <div class="space-y-2">
        <span class="text-base font-medium">Target cluster</span>
        <FilterSelect
          class="w-full max-w-none"
          label="Target cluster"
          placeholder="Select cluster…"
          options={moveClusterCandidates.map(c => ({
            value: String(c.id),
            label: `${c.name} (${c.defaultCluster ? 'default' : 'non-default'})`,
          }))}
          bind:value={moveTargetClusterId}
        />
      </div>
    {/if}
    <Dialog.Footer class="gap-2">
      <Button
        variant="outline"
        disabled={moveClusterSubmitting}
        onclick={() => { moveClusterOpen = false; moveTargetClusterId = '' }}
      >Cancel</Button>
      <Button variant="primary" disabled={!moveTargetClusterId || moveClusterSubmitting} onclick={submitMoveCluster}>
        {moveClusterSubmitting ? 'Moving…' : 'Move'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={deleteForkOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Delete Fork</Dialog.Title>
      {#if deleteForkTarget}
        <Dialog.Description class="mt-2">
          Fork <span class="font-semibold">{deleteForkTarget.name}</span> will be marked for deletion.
          Data cleanup starts after the grace period. You can restore during this window.
        </Dialog.Description>
      {/if}
    </Dialog.Header>
    {#if deleteForkTarget && deleteForkForce}
      <div class="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
        <ShieldAlert class="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div class="space-y-1.5">
          <p>
            Force delete will also remove
            {deleteForkTarget.children.length === 1 ? '1 child fork' : `${deleteForkTarget.children.length} direct  child forks`}.
          </p>
          <ul class="space-y-1" aria-label="Child forks that will be removed">
            {#each deleteForkTarget.children as child}
              <li class="flex items-center gap-1.5">
                <X class="size-3.5 shrink-0" aria-hidden="true" />
                <span class="font-semibold font-mono">{child.name}</span>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
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
      {#if restoreForkTarget}
        <Dialog.Description class="mt-2">
          Restore fork <span class="font-semibold">{restoreForkTarget.name}</span>? This will make it active again and allow client connections.
        </Dialog.Description>
      {/if}
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
  <Dialog.Content class="w-[min(100vw-2rem,640px)] sm:max-w-[640px]"
    onOpenAutoFocus={(e) => {
      e.preventDefault()
      document.getElementById('create-fork-name')?.focus()
    }}>
    <Dialog.Header>
      <Dialog.Title>Create Fork</Dialog.Title>
      <Dialog.Description class="mt-2">
        Snapshot the parent fork at the current moment, or rewind to a past point within the volume's retention window.
      </Dialog.Description>
    </Dialog.Header>
    <div class="space-y-4 py-2">
      <div class="space-y-1.5">
        <Label for="create-fork-parent" class="text-sm font-semibold">Parent Fork</Label>
        <ForkPicker
          options={forkParentOptions}
          value={createForkParent}
          placeholder="Select parent fork"
          onchange={(v) => (createForkParent = v ?? 'main')} />
      </div>
      <div class="space-y-1.5">
        <Label for="create-fork-name" class="text-sm font-semibold">
          Name <span class="text-destructive" aria-hidden="true">*</span>
        </Label>
        <Input id="create-fork-name" bind:value={createForkName}
          placeholder="lowercase-with-hyphens"
          required
          aria-invalid={!!createForkNameError}
          aria-describedby={createForkNameError ? 'create-fork-name-error create-fork-name-hint' : 'create-fork-name-hint'} />
        <div class="min-h-[2.5rem] space-y-1">
          {#if createForkNameError}
            <p id="create-fork-name-error" class="text-xs text-destructive">{createForkNameError}</p>
          {:else if createForkNameChanged}
            <p class="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <span>Will be saved as</span>
              <button
                type="button"
                aria-label={`Use sanitized name ${createForkSanitized}`}
                class="inline-flex min-h-[28px] items-center rounded-sm border border-border bg-card px-2 py-0.5 font-mono text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onclick={() => createForkName = createForkSanitized}
              >{createForkSanitized}</button>
            </p>
          {/if}
          <p id="create-fork-name-hint" class="text-xs text-muted-foreground">
            3–63 chars · lowercase letters, digits, <code>.</code> <code>-</code> · start/end alphanumeric
          </p>
        </div>
      </div>
      <div class="space-y-1.5">
        <div class="flex items-center gap-2">
          <Checkbox id="create-fork-asof" bind:checked={createForkAsOfEnabled} />
          <Label for="create-fork-asof" class="text-sm inline-flex items-center gap-1">
            Snapshot at past time <span class="text-xs text-muted-foreground font-mono">(UTC)</span>
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
      {#if forksLoading && createForkSanitized && !createForkNameError}
        <span class="mr-auto self-center text-xs text-muted-foreground">Checking existing forks…</span>
      {/if}
      <Button variant="outline" onclick={() => createForkOpen = false}>Cancel</Button>
      <Button
        variant="default"
        disabled={createForkLoading || forksLoading || !createForkSanitized || !!createForkNameError || (createForkAsOfEnabled && !createForkAsOfLocal)}
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
          {#if genResult.evictedApiKeys?.length}
            <p class="text-xs text-warning">
              Key limit reached, so the oldest key was revoked ({genResult.evictedApiKeys.join(', ')}).
            </p>
          {/if}
        </div>
      {/if}
      <div class="pt-2 flex justify-end">
        <Button variant="primary" class="cyberpunk-skewed-sm" onclick={closeCredentials}>Done</Button>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
