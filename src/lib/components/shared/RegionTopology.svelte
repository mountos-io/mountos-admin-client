<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { untrack } from 'svelte'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
  import { useRegionAuditLogs } from '$lib/core/stores/regionAudit.svelte'
  import { useRegionAlerts } from '$lib/core/stores/regionAlerts.svelte'
  import { SEVERITY_LABELS } from '$lib/core/stores/alerts.svelte'
  import { severityBadgeVariant, severityIcon, severityOptions, categoryOptions, timeOptions, handleTabKeydown } from '$lib/core/utils/alert'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { ROLE } from '$lib/core/auth/adapter'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import ListSkeleton from '$lib/components/shared/ListSkeleton.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import ActivityChart from '$lib/components/shared/ActivityChart.svelte'
  import ActivityFeed from '$lib/components/shared/ActivityFeed.svelte'
  import FilterPanel from '$lib/components/shared/FilterPanel.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import RegionNodeList from '$lib/components/shared/RegionNodeList.svelte'
  import ClusterPicker from '$lib/components/shared/ClusterPicker.svelte'
  import { handleApiError, showErrorToast, showSuccessToast } from '$lib/core/utils/toast'
  import { formatRelative, formatBinaryVersion } from '$lib/core/utils/format'
  import type { Region, ServiceNode } from '$lib/core/api/types'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import Plus from '@lucide/svelte/icons/plus'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import MoreVertical from '@lucide/svelte/icons/more-vertical'
  import Pencil from '@lucide/svelte/icons/pencil'
  import PowerOff from '@lucide/svelte/icons/power-off'
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover'
  import Shield from '@lucide/svelte/icons/shield'
  import Database from '@lucide/svelte/icons/database'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import HardDrive from '@lucide/svelte/icons/hard-drive'
  import Box from '@lucide/svelte/icons/box'
  import Cloud from '@lucide/svelte/icons/cloud'
  import Container from '@lucide/svelte/icons/container'
  import ServerOff from '@lucide/svelte/icons/server-off'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import CheckCircle from '@lucide/svelte/icons/check-circle'
  import Loader2 from '@lucide/svelte/icons/loader-2'
  import KeyRound from '@lucide/svelte/icons/key-round'
  import Copy from '@lucide/svelte/icons/copy'
  import Check from '@lucide/svelte/icons/check'
  import ShieldAlert from '@lucide/svelte/icons/shield-alert'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import HowItWorks from '$lib/components/shared/HowItWorks.svelte'
  import * as Dialog from '$lib/components/ui/dialog'
  import { api } from '$lib/core/stores/client.svelte'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import { copyText } from '$lib/core/utils/clipboard'

  let { regionId, basePath, initialTab }: { regionId: number; basePath: string; initialTab?: 'overview' | 'activity' | 'alerts' } = $props()

  const nodeStore = useNodes()
  const regionStore = useRegions()
  const clusterStore = useClusters()
  const regionAudit = useRegionAuditLogs()
  const auth = useAuth()

  const dialog = useConfirmDialog()
  const isSuperAdmin = $derived(auth.user?.role === ROLE.superadmin)
  const canEditRegion = $derived(auth.can('regions', 'update'))
  let resyncInFlight = $state(false)
  let regionMenuOpen = $state(false)

  const METRICS_TOKEN_EXPIRY_OPTIONS = [
    { label: 'Never expires', value: 0 },
    { label: '1 day', value: 86400 },
    { label: '7 days', value: 604800 },
    { label: '30 days', value: 2592000 },
  ]
  let metricsTokenExpiry = $state(0)
  let metricsTokenInFlight = $state(false)
  let metricsTokenOpen = $state(false)
  let metricsTokenResult = $state<{ token: string } | null>(null)
  let copiedMetricsToken = $state(false)

  async function generateMetricsToken() {
    metricsTokenInFlight = true
    try {
      metricsTokenResult = await api.metrics.generateToken({ expirySeconds: metricsTokenExpiry })
      metricsTokenOpen = true
    } catch (e: unknown) {
      handleApiError(e, 'Failed to generate metrics token')
    } finally {
      metricsTokenInFlight = false
    }
  }

  function closeMetricsToken() {
    metricsTokenOpen = false
    metricsTokenResult = null
    copiedMetricsToken = false
  }

  async function copyMetricsToken() {
    if (!metricsTokenResult) return
    if (await copyText(metricsTokenResult.token)) {
      copiedMetricsToken = true
      setTimeout(() => { copiedMetricsToken = false }, 1500)
    } else {
      showErrorToast('Copy failed, select and copy manually')
    }
  }

  let activeTab = $state<'overview' | 'activity' | 'alerts'>(untrack(() => initialTab) ?? 'overview')
  $effect(() => { if (initialTab) activeTab = initialTab })
  let topoView = $state<'graphical' | 'list'>('graphical')

  let region = $state<Region | null>(null)
  let hoveredNode = $state<{ node: ServiceNode; x: number; y: number } | null>(null)
  let expandedGroups = $state(new Set<string>())
  let dimmedServices = $state(new Set<string>())
  let auditView = $state<'chart' | 'feed'>('chart')
  let activityDays = $state<7 | 15 | 30 | 'auto'>('auto')

  // Alerts tab state
  const alertStore = useRegionAlerts(() => regionId, undefined, () => selectedCluster)
  let resolvingId = $state<string | null>(null)

  const COLLAPSE_THRESHOLD = 8
  const STATUS_COLORS: Record<string, string> = {
    healthy: 'var(--success)',
    registered: 'var(--primary)',
    unhealthy: 'var(--destructive)',
    draining: 'var(--warning)',
  }

  const SERVICE_PALETTE: Record<string, { accent: string; bg: string; label: string; icon: typeof Shield }> = {
    hub:           { accent: 'var(--pastel-region)',  bg: 'color-mix(in oklch, var(--pastel-region) 8%, transparent)',  label: 'Hub', icon: Shield },
    dataserv:      { accent: 'var(--pastel-user)',    bg: 'color-mix(in oklch, var(--pastel-user) 8%, transparent)',    label: 'Metadata', icon: Database },
    gcserv:        { accent: 'var(--pastel-role)',    bg: 'color-mix(in oklch, var(--pastel-role) 8%, transparent)',    label: 'Garbage Collection', icon: Trash2 },
    fuseserv:      { accent: 'var(--pastel-mount)',   bg: 'color-mix(in oklch, var(--pastel-mount) 8%, transparent)',   label: 'FUSE', icon: HardDrive },
    blockserv:     { accent: 'var(--pastel-storage)', bg: 'color-mix(in oklch, var(--pastel-storage) 8%, transparent)', label: 'Block', icon: Box },
    s3gatewayserv: { accent: 'var(--pastel-license)', bg: 'color-mix(in oklch, var(--pastel-license) 8%, transparent)', label: 'S3 Gateway', icon: Cloud },
    hdfsserv:      { accent: 'var(--pastel-license)', bg: 'color-mix(in oklch, var(--pastel-license) 8%, transparent)', label: 'HDFS Gateway', icon: Cloud },
    csiserv:       { accent: 'var(--pastel-session)', bg: 'color-mix(in oklch, var(--pastel-session) 8%, transparent)', label: 'CSI', icon: Container },
  }

  const TIER_COLORS: Record<string, string> = {
    control: 'var(--pastel-region)',
    data: 'var(--pastel-user)',
    storage: 'var(--pastel-storage)',
    gateway: 'var(--pastel-license)',
    edge: 'var(--pastel-mount)',
  }

  const TIERS = [
    { id: 'control', label: 'CONTROL', types: ['hub'] },
    { id: 'data', label: 'DATA', types: ['dataserv', 'gcserv'] },
    { id: 'storage', label: 'STORAGE', types: ['blockserv'] },
    { id: 'gateway', label: 'GATEWAY', types: ['s3gatewayserv', 'hdfsserv'] },
    { id: 'edge', label: 'CLIENT / EDGE', types: ['fuseserv', 'csiserv'] },
  ]

  const isHubRegion = $derived(nodeStore.nodesByType.has('hub'))
  const hasRegionalDB = $derived(nodeStore.nodesByType.has('dataserv') || nodeStore.nodesByType.has('gcserv'))
  const canReadAudit = $derived(auth.can('auditLogs', 'read'))
  const canReadAlerts = $derived(auth.can('alerts', 'read'))

  const clusters = $derived(clusterStore.clustersFor(regionId))
  const clusterNameById = $derived.by(() => {
    const m: Record<number, string> = {}
    for (const c of clusters) m[c.id] = c.name
    return m
  })
  const selectedCluster = $derived.by<number | null>(() => {
    const raw = $page.url.searchParams.get('cluster')
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    // Trust the URL until clusters load; only drop a stale/invalid id once the list is known.
    // Returning null mid-load then flipping to the id double-fires the cluster-scoped
    // nodes/alerts fetches (a deep-linked ?cluster=).
    if (clusters.length > 0 && !clusters.some(c => c.id === n)) return null
    return n
  })

  function setSelectedCluster(v: number | null) {
    const url = new URL($page.url)
    if (v == null) url.searchParams.delete('cluster')
    else url.searchParams.set('cluster', String(v))
    goto(url, { replaceState: true, noScroll: true, keepFocus: true })
  }

  function buildTierData(forNodes: ServiceNode[]) {
    const byType = new Map<string, ServiceNode[]>()
    for (const n of forNodes) {
      const key = n.serviceType === 'mfuse' ? 'fuseserv' : n.serviceType
      const list = byType.get(key) ?? []
      list.push(n)
      byType.set(key, list)
    }
    const hub = byType.has('hub')
    const relevant = hub ? TIERS.filter(t => t.id === 'control') : TIERS.filter(t => t.id !== 'control')
    return relevant.map(tier => ({
      ...tier,
      groups: tier.types
        .map(type => ({ type, nodes: byType.get(type) ?? [] }))
        .filter(g => g.nodes.length > 0),
      nodeCount: tier.types.reduce((sum, t) => sum + (byType.get(t)?.length ?? 0), 0),
    }))
  }

  const tierData = $derived(buildTierData(nodeStore.nodes))

  // When viewing "All clusters" in a multi-cluster region, render one tier
  // grid per cluster instead of one merged grid; preserves cluster cohesion.
  const showPerClusterGrouping = $derived(selectedCluster === null && clusters.length >= 2 && !isHubRegion)
  const clusterTierGroups = $derived.by(() => {
    if (!showPerClusterGrouping) return []
    return clusters
      .map(c => {
        const cn = nodeStore.nodes.filter(n => n.regionClusterId === c.id)
        return { cluster: c, tierData: buildTierData(cn), nodeCount: cn.length }
      })
      .filter(g => g.nodeCount > 0)
  })

  // Master rail: every active cluster (default first, then name) with its node
  // counts; empties stay visible but unselectable so operators see the cluster
  // exists yet has nothing to inspect.
  const clusterRail = $derived.by(() => {
    if (!showPerClusterGrouping) return []
    return clusters
      .filter(c => c.isActive)
      .map(c => {
        const cn = nodeStore.nodes.filter(n => n.regionClusterId === c.id)
        return {
          cluster: c,
          nodeCount: cn.length,
          healthyCount: cn.filter(n => n.status === 'healthy').length,
          empty: cn.length === 0,
        }
      })
      .sort((a, b) => {
        if (a.cluster.defaultCluster !== b.cluster.defaultCluster) return a.cluster.defaultCluster ? -1 : 1
        return a.cluster.name.localeCompare(b.cluster.name)
      })
  })

  // Rail selection is local (not the ?cluster URL) so the top-level picker stays
  // on "All" and the Stats HUD keeps aggregate totals while a single cluster is
  // detailed on the right. Resolved purely (no effect) to dodge update loops.
  let detailCluster = $state<number | null>(null)
  const detailClusterId = $derived.by<number | null>(() => {
    const rail = clusterRail
    const selectable = rail.filter(r => !r.empty)
    if (selectable.length === 0) return null
    if (detailCluster != null && selectable.some(r => r.cluster.id === detailCluster)) return detailCluster
    return selectable[0].cluster.id
  })
  const detailGroup = $derived(clusterTierGroups.find(g => g.cluster.id === detailClusterId) ?? null)

  // Rail can group by cluster or by storage. A storage is the set of blockserv
  // nodes sharing a storage_id; a live storage replicates one serving node into
  // each cluster, so the storage detail surfaces per-cluster coverage and gaps.
  let railMode = $state<'clusters' | 'storages'>('clusters')
  let detailStorage = $state<string | null>(null)

  const blockNodes = $derived(
    showPerClusterGrouping ? nodeStore.nodes.filter(n => n.serviceType === 'blockserv') : [],
  )
  const hasStorages = $derived(blockNodes.length > 0)
  const showStorages = $derived(railMode === 'storages' && hasStorages)

  // Prefer the human storage name the node reports; fall back to the short
  // storage UUID until the backend populates storage_name in node metadata.
  function storageName(nodes: ServiceNode[], storageId: string): string {
    for (const n of nodes) {
      const raw = n.metadata?.['storage_name']
      if (typeof raw === 'string' && raw) return raw
    }
    return shortStorageId(storageId)
  }

  const storageRail = $derived.by(() => {
    if (!showPerClusterGrouping) return []
    return groupByStorage(blockNodes).map(sg => ({
      storageId: sg.storageId,
      label: storageName(sg.nodes, sg.storageId),
      nodes: sg.nodes,
      nodeCount: sg.nodes.length,
      healthyCount: sg.nodes.filter(n => n.status === 'healthy').length,
      clusterCount: new Set(sg.nodes.map(n => n.regionClusterId)).size,
    }))
  })

  const detailStorageId = $derived.by<string | null>(() => {
    const rail = storageRail
    if (rail.length === 0) return null
    if (detailStorage != null && rail.some(s => s.storageId === detailStorage)) return detailStorage
    return rail[0].storageId
  })

  const storageDetail = $derived.by(() => {
    const group = storageRail.find(s => s.storageId === detailStorageId)
    if (!group) return null
    const activeClusters = clusters.filter(c => c.isActive)
    const perCluster = activeClusters.map(c => ({
      cluster: c,
      nodes: group.nodes.filter(n => n.regionClusterId === c.id),
    }))
    return {
      ...group,
      perCluster,
      clustersTotal: activeClusters.length,
      clustersCovered: perCluster.filter(p => p.nodes.length > 0).length,
    }
  })

  const legendEntries = $derived.by(() => {
    const byType = nodeStore.nodesByType
    const types = isHubRegion
      ? TIERS.filter(t => t.id === 'control').flatMap(t => t.types)
      : TIERS.filter(t => t.id !== 'control').flatMap(t => t.types)
    return types.map(type => {
      const p = palette(type)
      const count = byType.get(type)?.length ?? 0
      return { type, label: p.label, accent: p.accent, icon: p.icon, count, hasNodes: count > 0 }
    })
  })

  const topoStats = $derived.by(() => {
    const n = nodeStore.nodes
    return {
      total: n.length,
      healthy: n.filter(x => x.status === 'healthy').length,
      types: nodeStore.nodesByType.size,
    }
  })

  function statusColor(s: string) { return STATUS_COLORS[s] ?? 'var(--muted-foreground)' }

  function palette(type: string) {
    return SERVICE_PALETTE[type] ?? { accent: 'var(--muted-foreground)', bg: 'color-mix(in oklch, var(--muted-foreground) 8%, transparent)', label: type, icon: Box }
  }

  // blockserv nodes serve a single storage each; group them by metadata.storage_id so
  // operators see which members back which storage (insertion order preserved).
  function groupByStorage(nodes: ServiceNode[]) {
    const order: string[] = []
    const map = new Map<string, ServiceNode[]>()
    for (const n of nodes) {
      const raw = n.metadata?.['storage_id']
      const sid = typeof raw === 'string' && raw ? raw : 'unassigned'
      if (!map.has(sid)) { map.set(sid, []); order.push(sid) }
      map.get(sid)!.push(n)
    }
    return order.map(sid => ({ storageId: sid, nodes: map.get(sid)! }))
  }
  function shortStorageId(sid: string) {
    return sid === 'unassigned' ? 'unassigned' : `storage ${sid.slice(0, 8)}`
  }

  function toggleDim(type: string) {
    const next = new Set(dimmedServices)
    next.has(type) ? next.delete(type) : next.add(type)
    dimmedServices = next
  }

  function isDimmed(type: string) {
    return dimmedServices.has(type)
  }

  function toggleExpand(type: string) {
    const next = new Set(expandedGroups)
    next.has(type) ? next.delete(type) : next.add(type)
    expandedGroups = next
  }

  $effect(() => {
    if (!auth.loading && !auth.can('serviceNodes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
  })

  $effect(() => {
    if (regionId) {
      regionStore.getRegion(regionId).then(r => region = r).catch(() => showErrorToast('Failed to load region details'))
    }
  })

  // Fetch nodes whenever region or selected cluster changes; passes the
  // cluster filter through so the server returns scoped data when a cluster
  // is selected. The store calls inside must be untracked: clearFilters
  // writes the same $state that fetchNodes reads, which would otherwise
  // loop via effect_update_depth_exceeded.
  $effect(() => {
    if (!regionId) return
    const cluster = selectedCluster
    untrack(() => {
      nodeStore.clearFilters()
      nodeStore.fetchNodes(regionId, { regionClusterId: cluster ?? undefined })
    })
  })

  // Hub nodes aren't cluster-scoped (the hub's "uno" cluster exists only for
  // consistency); skip the cluster fetch for the topology view.
  $effect(() => {
    if (regionId && !isHubRegion) {
      untrack(() => {
        clusterStore.fetchClusters(regionId).catch(() => { /* non-fatal; picker stays hidden */ })
      })
    }
  })

  // Wait for cluster list before fetching audit logs: a deep-link like
  // ?cluster=2 cannot validate against the cluster list until it has loaded,
  // so without this gate the first fetch goes out unfiltered and is then
  // discarded once clusters arrive. Hub regions skip clusters entirely.
  const clustersReady = $derived(isHubRegion || !clusterStore.isLoading(regionId))

  $effect(() => {
    const cluster = selectedCluster
    if (regionId && canReadAudit && hasRegionalDB && clustersReady) {
      untrack(() => {
        regionAudit.fetchLogs(regionId, {
          limit: 200,
          reset: true,
          regionClusterId: cluster ?? undefined,
        })
      })
    } else if (!clustersReady) {
      // hold; effect will re-run when clusters land
    } else {
      untrack(() => regionAudit.reset())
    }
    return () => untrack(() => regionAudit.reset())
  })

  // Alerts lifecycle. lastAlertCluster is a plain (non-reactive) gate so
  // writing it inside the effect below cannot retrigger that effect; using
  // $state here would loop with effect_update_depth_exceeded.
  let lastAlertCluster: number | null = null
  $effect(() => {
    const s = alertStore
    if (auth.loading || !canReadAlerts) return
    untrack(() => {
      // Seed the cluster gate so the cluster-change effect below doesn't
      // double-fetch on initial mount when the URL already pins a cluster.
      lastAlertCluster = selectedCluster
      s.fetchAlerts()
      s.startPolling()
    })
    return () => s.reset()
  })

  // Refetch alerts + count when cluster filter changes (initial fetch is
  // handled above; this branch reacts only to subsequent selectedCluster
  // changes). The Alerts-tab badge derives from activeCount so it must
  // refresh in lockstep.
  $effect(() => {
    if (auth.loading || !canReadAlerts) return
    if (selectedCluster === lastAlertCluster) return
    lastAlertCluster = selectedCluster
    untrack(() => {
      alertStore.fetchAlerts()
      alertStore.fetchCount()
    })
  })

  const sevFilterStr = $derived(alertStore.severityFilter !== undefined ? String(alertStore.severityFilter) : '')
  function onSevChange(v: string) {
    alertStore.setSeverityFilter(v === '' ? undefined : Number(v))
  }

  async function handleResolve(alertId: string) {
    if (resolvingId) return
    resolvingId = alertId
    try {
      await alertStore.resolveAlert(alertId)
      showSuccessToast('Alert resolved')
    } catch {
      showErrorToast('Failed to resolve alert')
    } finally {
      resolvingId = null
    }
  }

  // Portal the node tooltip to document.body so `position: fixed` resolves to
  // the viewport even when an ancestor has a transform (e.g. Dialog content).
  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node)
      },
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center gap-3">
    <Button variant="ghost" size="sm" class="min-h-[44px] min-w-[44px]" onclick={() => goto(basePath)}>
      <ArrowLeft class="h-4 w-4" />
    </Button>
    <h1 class="text-2xl font-bold tracking-tight">{region?.name ?? 'Region'}</h1>
    {#if region}
      <Badge variant={region.isActive ? 'success' : 'secondary'}>
        {region.isActive ? 'Active' : 'Inactive'}
      </Badge>
    {/if}
    {#if !isHubRegion}
      <ClusterPicker
        clusters={clusters}
        value={selectedCluster}
        onchange={setSelectedCluster}
      />
    {/if}
    <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
      <HowItWorks topic="region" />
      {#if !isHubRegion && !auth.isUserRole}
        <Button
          variant="primary"
          size="sm"
          class="cyberpunk-skewed-sm gap-1.5 shadow-[0_0_14px_-3px_var(--primary)] hover:shadow-[0_0_20px_-2px_var(--primary)] transition-shadow"
          onclick={() => goto(`${basePath}/${regionId}/clusters/create`)}
        >
          <Plus class="size-3.5" aria-hidden="true" />
          New cluster
        </Button>
      {/if}
      <Button variant="outline" size="sm" onclick={() => goto(`${basePath}/${regionId}/clusters`)}>
        Clusters
      </Button>
      {#if isSuperAdmin}
        <span class="flex items-center gap-1.5">
          <Button variant="outline" size="sm" class="gap-1.5" disabled={resyncInFlight} aria-busy={resyncInFlight}
            onclick={() => dialog.confirm(
              'Vault Resync',
              'This will invalidate all vault caches across every service node and reload secrets from vault. Use sparingly.',
              async () => {
                resyncInFlight = true
                try { await api.vault.resync(); showSuccessToast('Vault resync initiated') }
                finally { resyncInFlight = false }
              },
            )}>
            <RefreshCw class="h-3.5 w-3.5 {resyncInFlight ? 'animate-spin' : ''}" />
            Vault Resync
          </Button>
          <InfoTip text="When vault secrets change (master keys, service verifier keys), resync forces all services to drop cached values and fetch fresh copies. Use only when needed; services auto-refresh periodically." />
        </span>
        <span class="flex items-center gap-1.5">
          <select
            bind:value={metricsTokenExpiry}
            aria-label="Metrics token expiry"
            class="h-9 rounded-sm border border-input bg-background px-2 text-sm"
          >
            {#each METRICS_TOKEN_EXPIRY_OPTIONS as opt (opt.value)}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
          <Button variant="outline" size="sm" class="gap-1.5" disabled={metricsTokenInFlight} aria-busy={metricsTokenInFlight}
            onclick={generateMetricsToken}>
            {#if metricsTokenInFlight}
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
            {:else}
              <KeyRound class="h-3.5 w-3.5" />
            {/if}
            Generate Metrics Token
          </Button>
          <InfoTip text="Mints a bearer token that only authorizes scraping /metrics on every service and the metrics service-discovery endpoint. Shown once; save it before closing the dialog." />
        </span>
      {/if}
      {#if canEditRegion}
        <Popover bind:open={regionMenuOpen}>
          <PopoverTrigger>
            {#snippet child({ props })}
              <button {...props}
                type="button"
                aria-label="Region actions"
                aria-haspopup="menu"
                aria-expanded={regionMenuOpen}
                class="inline-flex h-9 w-9 min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center rounded-sm border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MoreVertical class="h-4 w-4" />
              </button>
            {/snippet}
          </PopoverTrigger>
          <PopoverContent class="w-56 p-1" align="end">
            <div role="menu" aria-label="Region actions">
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                onclick={() => { regionMenuOpen = false; goto(`${basePath}/${regionId}/edit`) }}
              >
                <Pencil class="h-4 w-4" aria-hidden="true" /> Edit region
              </button>
              {#if region?.isActive}
                <div class="my-1 h-px bg-border/50" role="separator"></div>
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
                  onclick={() => {
                    regionMenuOpen = false
                    if (!region) return
                    dialog.confirm(
                      'Deactivate Region',
                      `Permanently deactivate "${region.name}"? All nodes must be stopped and all storages and volumes deactivated first.`,
                      async () => {
                        await regionStore.deactivateRegion(regionId)
                        showSuccessToast('Region deactivated')
                        goto(basePath)
                      },
                      'destructive',
                    )
                  }}
                >
                  <PowerOff class="h-4 w-4" aria-hidden="true" /> Deactivate region
                </button>
              {/if}
            </div>
          </PopoverContent>
        </Popover>
      {/if}
    </div>
  </div>

  <!-- Tab bar -->
  <div class="flex items-center rounded-md border border-border/50 p-0.5 w-fit" role="tablist" aria-label="Region details">
    <button
      role="tab"
      id="tab-overview"
      aria-selected={activeTab === 'overview'}
      aria-controls="panel-overview"
      tabindex={activeTab === 'overview' ? 0 : -1}
      class="tab-btn px-4 py-2 min-h-[44px] text-sm font-medium rounded transition-colors {activeTab === 'overview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => activeTab = 'overview'}
      onkeydown={handleTabKeydown}
    >Overview</button>
    <button
      role="tab"
      id="tab-activity"
      aria-selected={activeTab === 'activity'}
      aria-controls="panel-activity"
      tabindex={activeTab === 'activity' ? 0 : -1}
      class="tab-btn px-4 py-2 min-h-[44px] text-sm font-medium rounded transition-colors {activeTab === 'activity' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => activeTab = 'activity'}
      onkeydown={handleTabKeydown}
    >Activity Logs</button>
    {#if canReadAlerts}
      <button
        role="tab"
        id="tab-alerts"
        aria-selected={activeTab === 'alerts'}
        aria-controls="panel-alerts"
        tabindex={activeTab === 'alerts' ? 0 : -1}
        class="tab-btn px-4 py-2 min-h-[44px] text-sm font-medium rounded transition-colors inline-flex items-center gap-1.5 {activeTab === 'alerts' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
        onclick={() => activeTab = 'alerts'}
        onkeydown={handleTabKeydown}
      >
        Alerts
        {#if alertStore.activeCount > 0}
          <Badge variant="destructive" class="h-5 min-w-5 px-1 text-[10px] leading-none">{alertStore.activeCount}</Badge>
        {/if}
      </button>
    {/if}
  </div>

  <!-- Tab content -->
  {#if activeTab === 'overview'}
    <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" class="space-y-6">
    <!-- Stats HUD -->
    <div class="corner-brackets relative border border-border/30 rounded-sm p-5 w-fit max-w-full">
      <div class="tech-grid absolute inset-0 pointer-events-none"></div>
      <div class="relative flex flex-wrap items-end gap-x-6 gap-y-3">
        <div class="flex items-baseline gap-6">
          <div class="flex items-baseline gap-1.5">
            <span class="hud-value text-2xl font-bold tabular-nums leading-none tracking-tight">{topoStats.total}</span>
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">nodes</span>
          </div>
          <div class="h-7 w-px bg-border/40"></div>
          <div class="flex items-baseline gap-1.5">
            <span class="hud-value text-2xl font-bold tabular-nums leading-none tracking-tight" style="color: {STATUS_COLORS.healthy}; --hud-glow: {STATUS_COLORS.healthy};">{topoStats.healthy}</span>
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">healthy</span>
          </div>
          <div class="h-7 w-px bg-border/40"></div>
          <div class="flex items-baseline gap-1.5">
            <span class="hud-value text-2xl font-bold tabular-nums leading-none tracking-tight">{topoStats.types}</span>
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">types</span>
          </div>
        </div>
        {#if !nodeStore.loading && nodeStore.nodes.length > 0}
          <div class="hud-divider"></div>
          <div class="flex flex-wrap items-center gap-1.5">
            {#each legendEntries as entry (entry.type)}
              {#if entry.hasNodes}
                <button
                  class="legend-chip"
                  class:legend-dimmed={isDimmed(entry.type)}
                  style="--chip-accent: {entry.accent};"
                  onclick={() => toggleDim(entry.type)}
                  aria-pressed={!isDimmed(entry.type)}
                  title="{entry.label} ({entry.count})"
                >
                  <span class="legend-dot" style="background: {entry.accent};"></span>
                  <span class="legend-label">{entry.label}</span>
                  <span class="legend-count">{entry.count}</span>
                </button>
              {:else}
                <span class="legend-chip legend-inert" title="{entry.label}; no nodes">
                  <span class="legend-dot" style="background: color-mix(in oklch, var(--muted-foreground) 30%, transparent);"></span>
                  <span class="legend-label">{entry.label}</span>
                </span>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#snippet viewToggle()}
      <div class="flex items-center rounded-md border border-border/50 p-0.5" role="tablist" aria-label="Topology view">
        <button
          role="tab"
          aria-selected={topoView === 'list'}
          tabindex={topoView === 'list' ? 0 : -1}
          class="min-h-[44px] px-3 py-1 text-sm font-medium rounded transition-colors {topoView === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => topoView = 'list'}
          onkeydown={handleTabKeydown}
        >List</button>
        <button
          role="tab"
          aria-selected={topoView === 'graphical'}
          tabindex={topoView === 'graphical' ? 0 : -1}
          class="min-h-[44px] px-3 py-1 text-sm font-medium rounded transition-colors {topoView === 'graphical' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => topoView = 'graphical'}
          onkeydown={handleTabKeydown}
        >Graphical</button>
      </div>
    {/snippet}

    <!-- View toggle (master-detail moves it into the detail panel header) -->
    {#if !nodeStore.loading && nodeStore.nodes.length > 0 && !showPerClusterGrouping}
      <div class="flex justify-end">
        {@render viewToggle()}
      </div>
    {/if}

    <!-- Topology -->
    {#if nodeStore.loading}
      <div class="flex flex-wrap gap-5" role="status" aria-busy="true" aria-label="Loading topology">
        {#each { length: 3 } as _, i (i)}
          <div class="flex flex-col gap-3 w-full md:w-72 border border-border/50 rounded-sm p-3">
            <Skeleton class="h-4 w-24" />
            {#each { length: 3 } as _, j (j)}
              <Skeleton class="h-12 w-full" />
            {/each}
          </div>
        {/each}
      </div>
    {:else if nodeStore.nodes.length === 0}
      <EmptyState title="No nodes" description="No nodes registered in this region." />
    {:else if showPerClusterGrouping}
      <div class="corner-brackets relative flex flex-col md:flex-row border border-border/60 rounded-sm overflow-hidden md:h-[56vh] md:min-h-[420px] md:max-h-[680px]">
        <!-- Master rail: pick a cluster or storage -->
        <aside class="md:w-60 shrink-0 md:border-r border-b md:border-b-0 border-border/60 bg-foreground/[0.02] flex flex-col min-h-0" aria-label="Clusters and storages">
          {#if hasStorages}
            <div class="p-2 border-b border-border/40">
              <div class="flex items-center rounded-md border border-border/50 p-0.5" role="tablist" aria-label="Group rail by">
                {#each [['clusters', 'Clusters'], ['storages', 'Storages']] as [mode, label]}
                  <button
                    role="tab"
                    aria-selected={railMode === mode}
                    aria-controls="topo-rail-list"
                    tabindex={railMode === mode ? 0 : -1}
                    class="flex-1 min-h-[36px] px-2 py-1 text-[11px] font-medium rounded transition-colors {railMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
                    onclick={() => railMode = mode as 'clusters' | 'storages'}
                    onkeydown={handleTabKeydown}
                  >{label}</button>
                {/each}
              </div>
            </div>
          {:else}
            <div class="px-3 py-2 border-b border-border/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clusters</div>
          {/if}
          {#if showStorages}
            <div id="topo-rail-list" class="flex flex-col gap-1 p-2 flex-1 overflow-y-auto" role="group" aria-label="Select storage to inspect">
              {#each storageRail as s (s.storageId)}
                {@const active = s.storageId === detailStorageId}
                {@const dotColor = statusColor(s.healthyCount === s.nodeCount ? 'healthy' : 'draining')}
                <button
                  type="button"
                  aria-pressed={active}
                  title={s.storageId}
                  class="flex items-center gap-2 rounded-sm border px-2.5 py-2 text-left transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {active ? 'border-primary bg-primary/10' : 'border-transparent hover:border-border/60 hover:bg-foreground/[0.03]'}"
                  onclick={() => detailStorage = s.storageId}
                >
                  <span
                    class="led-dot block h-2 w-2 shrink-0 rounded-full"
                    class:led-ping={s.healthyCount === s.nodeCount}
                    style="background: {dotColor}; --led: {dotColor};"
                    aria-hidden="true"
                  ></span>
                  <span class="min-w-0 flex-1 truncate font-mono text-[13px] font-medium">{s.label}</span>
                  <span class="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground" aria-label="{s.clusterCount} clusters">{s.clusterCount}c</span>
                  <span class="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground" aria-label="{s.healthyCount} healthy of {s.nodeCount} nodes">{s.healthyCount}/{s.nodeCount}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div id="topo-rail-list" class="flex flex-col gap-1 p-2 flex-1 overflow-y-auto" role="group" aria-label="Select cluster to inspect">
              {#each clusterRail as r (r.cluster.id)}
                {@const active = r.cluster.id === detailClusterId}
                {@const dotColor = r.empty ? 'var(--muted-foreground)' : statusColor(r.healthyCount === r.nodeCount ? 'healthy' : 'draining')}
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={r.empty}
                  title={r.empty ? 'No nodes' : undefined}
                  class="flex items-center gap-2 rounded-sm border px-2.5 py-2 text-left transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 {active ? 'border-primary bg-primary/10' : 'border-transparent hover:border-border/60 hover:bg-foreground/[0.03]'}"
                  onclick={() => detailCluster = r.cluster.id}
                >
                  <span
                    class="led-dot block h-2 w-2 shrink-0 rounded-full"
                    class:led-ping={!r.empty && r.healthyCount === r.nodeCount}
                    style="background: {dotColor}; --led: {dotColor};"
                    aria-hidden="true"
                  ></span>
                  <span class="min-w-0 flex-1 truncate text-sm font-medium">{r.cluster.name}</span>
                  {#if r.cluster.defaultCluster}<span aria-hidden="true" class="rounded-sm bg-muted px-1 text-[10px] uppercase tracking-wider opacity-80">def</span>{/if}
                  {#if !r.cluster.isReady}<span aria-hidden="true" class="rounded-sm bg-warning/15 px-1 text-[10px] uppercase tracking-wider text-warning">prep</span>{/if}
                  <span class="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground" aria-label="{r.healthyCount} healthy of {r.nodeCount} nodes">{r.healthyCount}/{r.nodeCount}</span>
                </button>
              {/each}
            </div>
          {/if}
        </aside>

        <!-- Detail panel -->
        <div class="flex-1 min-w-0 flex flex-col min-h-0">
          {#if showStorages}
            {#if storageDetail}
              <div class="flex items-center gap-2 flex-wrap px-4 py-2.5 border-b border-border/40 shrink-0">
                <Box class="size-4 shrink-0" style="color: var(--pastel-storage);" aria-hidden="true" />
                <span class="font-semibold font-mono text-sm" title={storageDetail.storageId}>{storageDetail.label}</span>
                <span class="font-mono text-xs text-muted-foreground tabular-nums">{storageDetail.nodeCount} {storageDetail.nodeCount === 1 ? 'node' : 'nodes'}</span>
                {#if storageDetail.clustersCovered < storageDetail.clustersTotal}
                  <Badge variant="warning" class="h-4 text-[9px] uppercase tracking-wider">{storageDetail.clustersCovered}/{storageDetail.clustersTotal} clusters</Badge>
                {:else}
                  <span class="font-mono text-xs text-muted-foreground tabular-nums">{storageDetail.clustersCovered}/{storageDetail.clustersTotal} clusters</span>
                {/if}
              </div>
              <div class="flex-1 overflow-auto p-3 space-y-2.5">
                {#each storageDetail.perCluster as pc (pc.cluster.id)}
                  <div class="rounded-sm border border-border/50 overflow-hidden">
                    <div class="flex items-center gap-2 px-3 py-1.5 border-b border-border/30 bg-foreground/[0.02]">
                      <span class="text-sm font-medium">{pc.cluster.name}</span>
                      {#if pc.cluster.defaultCluster}<Badge variant="outline" class="h-4 text-[9px] uppercase tracking-wider">default</Badge>{/if}
                      <span class="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">{pc.nodes.length} {pc.nodes.length === 1 ? 'node' : 'nodes'}</span>
                    </div>
                    {#if pc.nodes.length === 0}
                      <div class="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground/70">
                        <ServerOff class="size-3.5 shrink-0" aria-hidden="true" />
                        <span>not served in this cluster</span>
                      </div>
                    {:else}
                      <div role="list" class="divide-y divide-border/20">
                        {#each pc.nodes as node (node.id)}
                          <button
                            class="node-row flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer hover:bg-foreground/[0.04]"
                            aria-label="View node {node.nodeId}, status {node.status}"
                            onclick={() => goto(`${basePath}/${regionId}/${node.nodeId}`)}
                            onpointerenter={(e: PointerEvent) => hoveredNode = { node, x: e.clientX, y: e.clientY }}
                            onpointermove={(e: PointerEvent) => { if (hoveredNode) hoveredNode = { node, x: e.clientX, y: e.clientY } }}
                            onpointerleave={() => hoveredNode = null}
                            onfocus={(e: FocusEvent) => { const r = (e.target as HTMLElement).getBoundingClientRect(); hoveredNode = { node, x: r.right, y: r.top } }}
                            onblur={() => hoveredNode = null}
                          >
                            <span
                              class="led-dot block h-2 w-2 shrink-0 rounded-full"
                              class:led-ping={node.status === 'healthy'}
                              style="background: {statusColor(node.status)}; --led: {statusColor(node.status)};"
                              aria-hidden="true"
                            ></span>
                            <span class="min-w-0 flex-1 truncate font-mono text-sm">{node.nodeId}</span>
                            {#if node.binaryVersion != null}
                              <Badge variant="outline" class="shrink-0 font-mono text-xs">{formatBinaryVersion(node.binaryVersion)}</Badge>
                            {/if}
                            <span class="shrink-0 font-mono text-xs text-muted-foreground">{node.advertiseAddr}</span>
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <EmptyState title="No storages" description="No block storage nodes registered in this region." />
            {/if}
          {:else if detailGroup}
            <div class="flex items-center gap-2 flex-wrap px-4 py-2.5 border-b border-border/40 shrink-0">
              <span class="font-semibold text-sm">{detailGroup.cluster.name}</span>
              {#if detailGroup.cluster.defaultCluster}
                <Badge variant="outline" class="h-4 text-[9px] uppercase tracking-wider">default</Badge>
              {/if}
              {#if !detailGroup.cluster.isReady}
                <Badge variant="warning" class="h-4 text-[9px] uppercase tracking-wider">not ready</Badge>
              {/if}
              <span class="font-mono text-xs text-muted-foreground tabular-nums">{detailGroup.nodeCount} nodes</span>
              <div class="ml-auto">{@render viewToggle()}</div>
            </div>
            <div class="flex-1 overflow-auto p-3">
              {#if topoView === 'list'}
                <RegionNodeList tierData={detailGroup.tierData} {basePath} {regionId} embedded />
              {:else}
                {@render graphicalGrid(detailGroup.tierData)}
              {/if}
            </div>
          {:else}
            <EmptyState title="No nodes" description="No cluster in this region has registered nodes yet." />
          {/if}
        </div>
      </div>
    {:else if topoView === 'list'}
      <RegionNodeList {tierData} {basePath} {regionId} />
    {:else}
      {@render graphicalGrid(tierData)}
    {/if}

    {#snippet graphicalGrid(td: ReturnType<typeof buildTierData>)}
      <div class="topo-grid scanlines relative flex flex-wrap gap-5" style="contain: layout;">
        {#snippet nodeRow(node: ServiceNode, isDataserv: boolean)}
          <button
            class="node-row flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer hover:bg-foreground/[0.04]"
            aria-label="View node {node.nodeId}, status {node.status}"
            onclick={() => goto(`${basePath}/${regionId}/${node.nodeId}`)}
            onpointerenter={(e: PointerEvent) => hoveredNode = { node, x: e.clientX, y: e.clientY }}
            onpointermove={(e: PointerEvent) => { if (hoveredNode) hoveredNode = { node, x: e.clientX, y: e.clientY } }}
            onpointerleave={() => hoveredNode = null}
            onfocus={(e: FocusEvent) => { const r = (e.target as HTMLElement).getBoundingClientRect(); hoveredNode = { node, x: r.right, y: r.top } }}
            onblur={() => hoveredNode = null}
          >
            <span
              class="led-dot block h-2 w-2 shrink-0 rounded-full"
              class:led-ping={node.status === 'healthy'}
              class:led-raft={isDataserv}
              style="background: {statusColor(node.status)}; --led: {statusColor(node.status)};"
              aria-hidden="true"
            ></span>
            <span class="min-w-0 flex-1 truncate font-mono text-sm">{node.nodeId}</span>
            {#if node.binaryVersion != null}
              <Badge variant="outline" class="shrink-0 font-mono text-xs">{formatBinaryVersion(node.binaryVersion)}</Badge>
            {/if}
            <span class="shrink-0 font-mono text-xs text-muted-foreground">{node.advertiseAddr}</span>
          </button>
        {/snippet}
        {#each td as tier (tier.id)}
          {@const tierColor = TIER_COLORS[tier.id]}
          <section class="tier-column corner-brackets flex flex-col gap-3 w-full md:w-auto border border-border/80 rounded-sm p-3" aria-label="{tier.label} tier">
              <div class="flex items-center gap-2">
                <span
                  class="tier-label-glow text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                  style:color={tierColor}
                >{tier.label}</span>
                {#if tier.nodeCount > 0}
                  <span class="text-xs text-muted-foreground tabular-nums">{tier.nodeCount}</span>
                {/if}
                <div class="ml-auto flex items-center gap-1.5">
                  {#if tier.id === 'data' || tier.id === 'control'}
                    <span class="tier-infra-icon" style="color: var(--pastel-user);" title="Regional DB Access">
                      <Database class="h-3.5 w-3.5" />
                    </span>
                  {/if}
                  <span class="tier-infra-icon" style="color: var(--pastel-volume-key);" title="Regional Vault Access">
                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                      <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </span>
                </div>
              </div>

              {#if tier.groups.length === 0}
                <div class="flex items-center justify-center rounded-sm border border-dashed border-border/30 px-6 py-8 md:w-[420px] md:max-w-full">
                  <span class="text-xs uppercase tracking-wider text-muted-foreground/40">no nodes</span>
                </div>
              {/if}
              {#each tier.groups as group (group.type)}
                {@const p = palette(group.type)}
                {@const Icon = p.icon}
                {@const isDataserv = group.type === 'dataserv'}
                {@const expanded = expandedGroups.has(group.type)}
                {@const needsCollapse = group.nodes.length > COLLAPSE_THRESHOLD}
                {@const visibleNodes = expanded || !needsCollapse ? group.nodes : group.nodes.slice(0, COLLAPSE_THRESHOLD)}
                {@const hiddenCount = group.nodes.length - visibleNodes.length}
                <Card
                  cornerBrackets
                  class="svc-card corner-plus-bl relative overflow-hidden gap-0 py-0 w-full md:w-[420px] md:max-w-full {isDimmed(group.type) ? 'svc-dimmed' : ''}"
                  style="--svc-accent: {p.accent}; --svc-bg: {p.bg};"
                >
                  <div class="svc-glow pointer-events-none"></div>
                  {#if isDataserv}
                    <div class="tech-grid-bg absolute inset-0 pointer-events-none"></div>
                  {/if}

                  <div class="relative">
                    <div class="flex items-center gap-2 px-3 pt-3 pb-2">
                      <span style:color={p.accent} class="shrink-0">
                        <Icon class="h-4 w-4" />
                      </span>
                      <span class="text-sm font-semibold">{p.label}</span>
                      <div class="ml-auto flex items-center gap-1.5">
                        {#if isDataserv}
                          <span class="svc-tag font-mono" style="--tag-color: {p.accent};">RAFT</span>
                        {/if}
                        <span class="svc-count font-mono" style="--tag-color: {p.accent};">{group.nodes.length}</span>
                      </div>
                    </div>

                    <div role="list" aria-label="{p.label} nodes" class="divide-y divide-border/20">
                      {#if group.type === 'blockserv'}
                        {#each groupByStorage(group.nodes) as sg (sg.storageId)}
                          {@const linkable = showPerClusterGrouping && sg.storageId !== 'unassigned'}
                          <svelte:element
                            this={linkable ? 'button' : 'div'}
                            role={linkable ? 'button' : undefined}
                            type={linkable ? 'button' : undefined}
                            title={sg.storageId === 'unassigned' ? 'No storage_id in node metadata' : sg.storageId}
                            aria-label={linkable ? `View storage ${storageName(sg.nodes, sg.storageId)} across all clusters` : undefined}
                            class="storage-head flex w-full items-center gap-1.5 bg-foreground/[0.02] px-3 py-1 text-left {linkable ? 'cursor-pointer transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : ''}"
                            onclick={linkable ? () => { railMode = 'storages'; detailStorage = sg.storageId } : undefined}
                          >
                            <Box class="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span class="truncate font-mono text-[10px] text-muted-foreground">{storageName(sg.nodes, sg.storageId)}</span>
                            <span class="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">{sg.nodes.length}</span>
                            {#if linkable}<ChevronRight class="size-3 shrink-0 text-muted-foreground/60" aria-hidden="true" />{/if}
                          </svelte:element>
                          {#each sg.nodes as node (node.id)}
                            {@render nodeRow(node, isDataserv)}
                          {/each}
                        {/each}
                      {:else}
                        {#each visibleNodes as node (node.id)}
                          {@render nodeRow(node, isDataserv)}
                        {/each}
                      {/if}
                    </div>

                    {#if needsCollapse && group.type !== 'blockserv'}
                      <button
                        class="min-h-[44px] flex w-full items-center justify-center gap-1 border-t border-border/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/[0.03]"
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Show less' : `Show ${hiddenCount} more ${p.label} nodes`}
                        onclick={() => toggleExpand(group.type)}
                      >
                        <ChevronDown class="h-3 w-3 transition-transform" style="transform: rotate({expanded ? 180 : 0}deg);" />
                        {expanded ? 'Show less' : `+${hiddenCount} more`}
                      </button>
                    {:else}
                      <div class="h-2"></div>
                    {/if}
                  </div>
                </Card>
              {/each}
          </section>
        {/each}
      </div>
    {/snippet}

    <!-- Audit log card -->
    {#if canReadAudit}
      {#if !nodeStore.loading}
        {#if hasRegionalDB}
          <Card cornerPlus>
            <CardHeader>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Region Audit Log</CardTitle>
                <div class="relative border border-border/30 rounded-sm px-3 py-2 w-full sm:w-fit">
                  <div class="tech-grid absolute inset-0 pointer-events-none"></div>
                  <div class="relative flex flex-wrap items-center gap-1.5">
                    <div class="flex items-center gap-1.5">
                      <Button variant={activityDays === 'auto' ? 'primary' : 'ghost'} size="sm"
                        class="h-7 w-12 min-h-[44px] sm:min-h-0 text-xs font-mono justify-center"
                        onclick={() => activityDays = 'auto'}>Auto</Button>
                      {#each [7, 15, 30] as const as d}
                        <Button variant={activityDays === d ? 'primary' : 'ghost'} size="sm"
                          class="h-7 w-10 min-h-[44px] sm:min-h-0 text-xs font-mono justify-center"
                          onclick={() => activityDays = d}>{d}d</Button>
                      {/each}
                    </div>
                    <span class="filter-divider hidden sm:block"></span>
                    <div class="flex items-center gap-1.5">
                      {#each ['feed', 'chart'] as v}
                        <Button variant={auditView === v ? 'primary' : 'ghost'} size="sm"
                          class="h-7 px-3 min-h-[44px] sm:min-h-0 text-xs font-mono capitalize justify-center"
                          onclick={() => auditView = v as 'chart' | 'feed'}>{v}</Button>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent aria-live="polite">
              <div class="audit-content-scroll">
                {#if regionAudit.loading && regionAudit.logs.length === 0}
                  <ListSkeleton rows={5} class="py-2" />
                {:else if regionAudit.error}
                  <div class="flex items-center justify-center gap-2 py-16 text-sm text-destructive">
                    <span>Failed to load audit logs</span>
                    <Button variant="ghost" size="sm" class="h-7 px-2 min-h-[44px] sm:min-h-0 text-xs"
                      onclick={() => regionAudit.fetchLogs(regionId, { limit: 200, reset: true, regionClusterId: selectedCluster ?? undefined })}>Retry</Button>
                  </div>
                {:else if regionAudit.logs.length === 0}
                  <div class="flex items-center justify-center py-16 text-sm text-muted-foreground">No regional audit activity</div>
                {:else if auditView === 'chart'}
                  {@const days = activityDays}
                  {@const filtered = days === 'auto'
                    ? regionAudit.logs
                    : regionAudit.logs.filter(l => new Date(l.createdAt ?? '').getTime() >= Date.now() - days * 86400000)}
                  {#if filtered.length === 0}
                    <div class="flex items-center justify-center py-16 text-sm text-muted-foreground">No activity in last {activityDays} days</div>
                  {:else}
                    <ActivityChart logs={filtered} rangeMs={days === 'auto' ? undefined : days * 86400000} />
                  {/if}
                {:else}
                  <ActivityFeed
                    logs={regionAudit.logs}
                    loading={regionAudit.loading}
                    hasMore={regionAudit.hasMore}
                    {clusterNameById}
                    onLoadMore={() => regionAudit.fetchLogs(regionId, { limit: 200, regionClusterId: selectedCluster ?? undefined })}
                  />
                {/if}
              </div>
            </CardContent>
          </Card>
        {:else}
          <div class="flex items-center gap-2 rounded-sm border border-dashed border-border/50 px-4 py-6 text-sm text-muted-foreground">
            <ServerOff class="h-4 w-4 shrink-0" />
            <span>No dataserv or gcserv nodes in this region to fetch audit logs</span>
          </div>
        {/if}
      {/if}
    {/if}
    </div>

  {:else if activeTab === 'activity'}
    <div role="tabpanel" id="panel-activity" aria-labelledby="tab-activity">
    <!-- Activity Logs tab -->
    <div class="activity-tab-scroll" style="overflow-y: auto; max-height: calc(100vh - 180px);">
      {#if !canReadAudit}
        <EmptyState title="Access denied" description="You do not have permission to view audit logs." />
      {:else if !hasRegionalDB && !nodeStore.loading}
        <div class="flex items-center gap-2 rounded-sm border border-dashed border-border/50 px-4 py-6 text-sm text-muted-foreground">
          <ServerOff class="h-4 w-4 shrink-0" />
          <span>No dataserv or gcserv nodes in this region to fetch audit logs</span>
        </div>
      {:else}
        <ActivityFeed
          logs={regionAudit.logs}
          loading={regionAudit.loading}
          hasMore={regionAudit.hasMore}
          {clusterNameById}
          onLoadMore={() => regionAudit.fetchLogs(regionId, { limit: 200, regionClusterId: selectedCluster ?? undefined })}
        />
      {/if}
    </div>
    </div>

  {:else if activeTab === 'alerts'}
    <div role="tabpanel" id="panel-alerts" aria-labelledby="tab-alerts">
    <!-- Alerts tab -->
    <div class="space-y-4">
      {#if alertStore.activeCount > 0}
        <Badge variant="destructive" aria-live="polite">{alertStore.activeCount} active</Badge>
      {/if}

      <FilterPanel>
        <FilterSelect
          options={severityOptions}
          value={sevFilterStr}
          placeholder="Severity"
          label="Filter by severity"
          onchange={onSevChange}
        />
        <FilterSelect
          options={categoryOptions}
          value={alertStore.categoryFilter}
          placeholder="Category"
          label="Filter by category"
          onchange={(v) => alertStore.setCategoryFilter(v)}
        />
        <FilterSelect
          options={timeOptions}
          value={alertStore.sinceFilter}
          placeholder="Time range"
          label="Filter by time range"
          onchange={(v) => alertStore.setSinceFilter(v)}
        />
        {#if alertStore.severityFilter !== undefined || alertStore.categoryFilter || alertStore.sinceFilter !== '3d'}
          <Button variant="ghost" size="sm" onclick={() => alertStore.clearFilters()}>Clear filters</Button>
        {/if}
        <div class="ml-auto flex items-center rounded-md border border-border/50 p-0.5" role="tablist" aria-label="Alert status">
          <button
            role="tab"
            aria-selected={alertStore.activeFilter}
            tabindex={alertStore.activeFilter ? 0 : -1}
            class="px-3 py-1 text-sm font-medium rounded transition-colors {alertStore.activeFilter ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => alertStore.setActiveFilter(true)}
            onkeydown={handleTabKeydown}
          >Active</button>
          <button
            role="tab"
            aria-selected={!alertStore.activeFilter}
            tabindex={!alertStore.activeFilter ? 0 : -1}
            class="px-3 py-1 text-sm font-medium rounded transition-colors {!alertStore.activeFilter ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => alertStore.setActiveFilter(false)}
            onkeydown={handleTabKeydown}
          >All</button>
        </div>
      </FilterPanel>

      {#snippet alertsHeaderRow()}
        <TableRow>
          <TableHead class="w-28">Severity</TableHead>
          <TableHead class="w-24">Category</TableHead>
          <TableHead>Title</TableHead>
          <TableHead class="hidden lg:table-cell">Source</TableHead>
          <TableHead class="hidden xl:table-cell">Node</TableHead>
          <TableHead class="w-32">Time</TableHead>
          <TableHead class="w-20">Actions</TableHead>
        </TableRow>
      {/snippet}

      {#if alertStore.loading && alertStore.alerts.length === 0}
        <Card cornerPlus class="px-4">
          <TableSkeleton
            header={alertsHeaderRow}
            caption="Loading region alerts"
            cells={[
              { width: 'w-16', height: 'h-5' },
              { width: 'w-14' },
              { width: 'w-48' },
              { width: 'w-20', class: 'hidden lg:table-cell' },
              { width: 'w-24', class: 'hidden xl:table-cell' },
              { width: 'w-20' },
              { width: 'w-16', height: 'h-5' },
            ]}
          />
        </Card>
      {:else if alertStore.error}
        <Card cornerPlus>
          <CardContent class="py-8 space-y-3">
            <p class="text-center text-destructive" role="alert">{alertStore.error}</p>
            <div class="flex justify-center">
              <Button variant="outline" size="sm" onclick={() => alertStore.fetchAlerts()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      {:else if alertStore.alerts.length === 0}
        <EmptyState title="No alerts" description="No alerts match your current filters" />
      {:else}
        <Card cornerPlus class="px-4">
          <Table>
            <caption class="sr-only">Region alerts</caption>
            <TableHeader>
              {@render alertsHeaderRow()}
            </TableHeader>
            <TableBody>
              {#each alertStore.alerts as alert (alert.alertId)}
                {@const SevIcon = severityIcon(alert.severity)}
                <TableRow>
                  <TableCell>
                    <Badge variant={severityBadgeVariant(alert.severity)} class="gap-1">
                      <SevIcon class="h-3 w-3" />
                      {SEVERITY_LABELS[alert.severity] ?? 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span class="capitalize">{alert.category}</span>
                  </TableCell>
                  <TableCell>
                    <div class="min-w-0">
                      <p class="font-medium truncate" title={alert.title}>{alert.title}</p>
                      {#if alert.description}
                        <p class="text-muted-foreground truncate mt-0.5" title={alert.description}>{alert.description}</p>
                      {/if}
                    </div>
                  </TableCell>
                  <TableCell class="hidden lg:table-cell">
                    <div class="flex flex-wrap items-center gap-1">
                      <Badge variant="outline" class="font-mono">{alert.source}</Badge>
                      {#if selectedCluster === null && alert.regionClusterId != null && clusterNameById[alert.regionClusterId]}
                        <Badge variant="outline" class="font-mono text-[10px] uppercase tracking-wider">{clusterNameById[alert.regionClusterId]}</Badge>
                      {/if}
                    </div>
                  </TableCell>
                  <TableCell class="hidden xl:table-cell">
                    {#if alert.nodeId}
                      <a href="{basePath}/{regionId}/{alert.nodeId}" class="font-mono text-primary hover:underline">{alert.nodeId}</a>
                    {:else}
                      <span class="text-muted-foreground">(not set)</span>
                    {/if}
                  </TableCell>
                  <TableCell>
                    <span class="text-muted-foreground whitespace-nowrap">{formatRelative(alert.eventTime)}</span>
                  </TableCell>
                  <TableCell>
                    {#if !alert.resolvedAt}
                      {@const isResolving = resolvingId === alert.alertId}
                      <Button variant="ghost" size="sm" disabled={!!resolvingId} aria-busy={isResolving} onclick={() => handleResolve(alert.alertId)} class="h-7 min-h-[44px] gap-1">
                        {#if isResolving}
                          <Loader2 class="h-3.5 w-3.5 animate-spin" />
                        {:else}
                          <CheckCircle class="h-3.5 w-3.5" />
                        {/if}
                        Resolve
                      </Button>
                    {:else}
                      <Badge variant="outline">Resolved</Badge>
                    {/if}
                  </TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>
        </Card>

        {#if alertStore.totalPages > 1}
          <Pagination
            currentPage={alertStore.page}
            totalPages={alertStore.totalPages}
            onPageChange={(p) => alertStore.setPage(p)}
          />
        {/if}
      {/if}
    </div>
    </div>
  {/if}
</div>

{#if hoveredNode}
  <div
    use:portal
    role="tooltip"
    class="tooltip-card fixed z-50 pointer-events-none rounded-sm border bg-card"
    style:left="{hoveredNode.x + 16}px"
    style:top="{hoveredNode.y - 12}px"
  >
    <div class="h-[2px] rounded-t-sm" style="background: {statusColor(hoveredNode.node.status)};"></div>
    <div class="px-3 py-2.5">
      <div class="font-mono text-sm font-semibold">{hoveredNode.node.nodeId}</div>
      <div class="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
        <div class="flex justify-between gap-4">
          <span>Service</span>
          <span class="text-foreground">{hoveredNode.node.serviceType}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span>Status</span>
          <span style:color={statusColor(hoveredNode.node.status)}>{hoveredNode.node.status}</span>
        </div>
        {#if hoveredNode.node.binaryVersion != null}
          <div class="flex justify-between gap-4">
            <span>Version</span>
            <span class="text-foreground font-mono">{formatBinaryVersion(hoveredNode.node.binaryVersion)}</span>
          </div>
        {/if}
        <div class="flex justify-between gap-4">
          <span>Address</span>
          <span class="text-foreground font-mono">{hoveredNode.node.advertiseAddr}</span>
        </div>
        {#if hoveredNode.node.lastHeartbeat}
          <div class="flex justify-between gap-4">
            <span>Heartbeat</span>
            <span class="text-foreground">{formatRelative(hoveredNode.node.lastHeartbeat)}</span>
          </div>
        {/if}
        <div class="text-foreground/50 mt-1.5 text-center border-t border-border/30 pt-1.5">click to view details</div>
      </div>
    </div>
  </div>
{/if}

<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} onConfirm={dialog.action} />

<Dialog.Root bind:open={metricsTokenOpen} onOpenChange={(v) => { if (!v) closeMetricsToken() }}>
  <Dialog.Content class="sm:max-w-lg">
    <Dialog.Header>
      <div class="flex items-start gap-3">
        <ShieldAlert class="size-5 shrink-0 text-warning mt-0.5" />
        <div class="flex flex-col gap-1">
          <Dialog.Title>Metrics Token Generated</Dialog.Title>
          <Dialog.Description>
            Copy and save this token now. It will not be shown again.
          </Dialog.Description>
        </div>
      </div>
    </Dialog.Header>
    {#if metricsTokenResult}
      <div class="flex items-center gap-2">
        <code class="flex-1 font-mono text-sm break-all bg-muted/50 rounded-sm px-2.5 py-1.5 border select-all">{metricsTokenResult.token}</code>
        <button type="button"
          class="shrink-0 size-11 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onclick={copyMetricsToken} aria-label="Copy metrics token">
          {#if copiedMetricsToken}<Check class="size-4 text-success" />{:else}<Copy class="size-4" />{/if}
        </button>
      </div>
    {/if}
    <Dialog.Footer>
      <Button variant="primary" onclick={closeMetricsToken}>Done</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .audit-content-scroll {
    min-height: min(500px, 50vh);
    max-height: min(500px, 50vh);
    overflow-y: auto;
  }

  .filter-divider {
    width: 1px;
    height: 24px;
    margin: 0 10px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      oklch(0.6 0.08 250 / 0.5) 30%,
      oklch(0.6 0.08 250 / 0.25) 70%,
      transparent 100%
    );
  }

  .hud-value {
    text-shadow: 0 0 12px var(--hud-glow, color-mix(in oklch, var(--foreground) 15%, transparent));
  }

  .hud-divider {
    position: relative;
    top: 8px;
    width: 1px;
    height: 40px;
    background: color-mix(in oklch, var(--border) 70%, transparent);
  }

  .svc-tag {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    padding: 1px 6px;
    border: 1px solid var(--tag-color);
    color: var(--tag-color);
    text-shadow: 0 0 8px var(--tag-color);
  }

  .svc-count {
    font-size: 11px;
    font-weight: 700;
    padding: 0 6px;
    color: var(--tag-color);
    text-shadow: 0 0 8px var(--tag-color);
  }

  :global(.svc-card[data-slot="card"]) {
    box-shadow: inset 0 1px 0 color-mix(in oklch, var(--svc-accent) 40%, transparent);
  }

  .svc-glow {
    position: absolute;
    inset: 0;
    background: color-mix(in oklch, var(--svc-bg) 35%, transparent);
  }

  .tier-infra-icon {
    opacity: 0.4;
    transition: opacity 0.2s;
    cursor: default;
  }

  .tier-infra-icon:hover {
    opacity: 0.8;
  }

  .tier-label-glow {
    text-shadow: 0 0 10px currentColor;
  }

  .scanlines::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      oklch(0 0 0 / 0.012) 3px,
      oklch(0 0 0 / 0.012) 4px
    );
    pointer-events: none;
    z-index: 0;
  }

  .scanlines > * {
    position: relative;
    z-index: 1;
  }

  .tooltip-card {
    background: var(--popover);
    border: 1px solid var(--border);
    max-width: 280px;
  }

  .led-dot {
    box-shadow: 0 0 6px var(--led);
  }

  .led-raft {
    box-shadow: 0 0 0 2px var(--color-card), 0 0 0 3.5px var(--led), 0 0 6px var(--led);
  }

  .tech-grid-bg {
    background-image:
      linear-gradient(oklch(0.60 0.14 260 / 0.04) 1px, transparent 1px),
      linear-gradient(90deg, oklch(0.60 0.14 260 / 0.04) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  button.node-row {
    position: relative;
    transition: background 0.15s;
  }

  button.node-row:hover {
    background: color-mix(in oklch, var(--svc-accent, var(--color-primary)) 8%, transparent);
  }

  .legend-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--chip-accent, color-mix(in oklch, var(--muted-foreground) 20%, transparent));
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    cursor: pointer;
    transition: opacity 0.2s, filter 0.2s, border-color 0.2s;
    user-select: none;
    background: transparent;
    color: inherit;
  }

  .legend-chip:hover:not(.legend-inert) {
    background: color-mix(in oklch, var(--chip-accent, var(--muted-foreground)) 6%, transparent);
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 5px currentColor;
  }

  .legend-label {
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .legend-count {
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
    opacity: 0.6;
  }

  .legend-dimmed {
    opacity: 0.35;
    filter: saturate(0.2);
    border-color: color-mix(in oklch, var(--muted-foreground) 15%, transparent);
  }

  .legend-dimmed:hover {
    opacity: 0.5;
    border-color: var(--border);
  }

  .legend-dimmed .legend-dot {
    box-shadow: none;
  }

  .legend-inert {
    cursor: default;
    opacity: 0.25;
    border-color: color-mix(in oklch, var(--muted-foreground) 10%, transparent);
  }

  :global(.svc-dimmed[data-slot="card"]) {
    opacity: 0.25;
    filter: saturate(0.15);
    transition: opacity 0.3s, filter 0.3s;
  }

  :global(.svc-dimmed[data-slot="card"]:hover) {
    opacity: 0.4;
    filter: saturate(0.3);
  }

</style>
