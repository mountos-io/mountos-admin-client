<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { api } from '$lib/core/stores/client.svelte'
  import type { ExclusiveGrant, ExclusiveGrantsResponse } from '$lib/core/api/types'
  import { classifyFailure, formatClockMs, grantRoleLabel, grantsForMount, grantStateVariant, liveLabel, scopeLabel, type LoadFailure, type MountIdentity } from '$lib/core/utils/exclusive'
  import { formatDate, formatRelative } from '$lib/core/utils/format'

  let { volumeId, fork, mount, exclusivePath }: {
    volumeId: number
    fork?: string
    mount: MountIdentity
    exclusivePath?: string
  } = $props()

  let result = $state<ExclusiveGrantsResponse | null>(null)
  let loading = $state(true)
  let failure = $state<LoadFailure | null>(null)
  let ctrl: AbortController | null = null

  async function load() {
    ctrl?.abort()
    const c = ctrl = new AbortController()
    loading = true
    failure = null
    try {
      const r = await api.volumes.exclusiveGrants(volumeId, fork, undefined, c.signal)
      if (ctrl === c) result = r
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      if (ctrl === c) { result = null; failure = classifyFailure(e) }
    } finally {
      if (ctrl === c) loading = false
    }
  }

  $effect(() => {
    void volumeId
    void fork
    load()
  })

  onDestroy(() => ctrl?.abort())

  const grants = $derived<ExclusiveGrant[]>(result ? grantsForMount(result.grants, mount, exclusivePath) : [])
  // A mount without an exclusive flag and without a matching grant shows nothing.
  const askedForLease = $derived(exclusivePath !== undefined)
</script>

{#if failure !== 'forbidden' && !(failure === 'not-found')}
  {#if loading && !result}
    <div class="corner-brackets relative border border-border/30 rounded-sm">
      <div class="relative p-5"><p class="text-sm text-muted-foreground" role="status">Loading exclusive grant</p></div>
    </div>
  {:else if failure}
    <div class="corner-brackets relative border border-border/30 rounded-sm">
      <div class="relative p-5 flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold">Exclusive grant</h2>
        <span role="alert" class="text-sm text-destructive">The grants could not be loaded.</span>
        <Button variant="outline" size="sm" class="min-h-[44px] sm:min-h-8" onclick={load}>Retry</Button>
      </div>
    </div>
  {:else if grants.length > 0 || askedForLease}
    <div class="corner-brackets relative border border-border/30 rounded-sm">
      <div class="tech-grid absolute inset-0 pointer-events-none"></div>
      <div class="relative p-5 space-y-4">
        <h2 class="text-lg font-semibold">Exclusive grant</h2>

        {#if result && !result.ownerReachable}
          <p class="text-sm text-warning" role="note">The owner is not reachable. Live status is unknown.</p>
        {/if}

        {#if grants.length === 0}
          <p class="text-sm text-muted-foreground">
            No grant on fork {result?.fork || 'main'} matches this mount{#if askedForLease}, though it asked for one{/if}. The grant may be on another fork.
          </p>
        {/if}

        {#each grants as g (g.sessionId + g.scopeInode + g.role + g.standbyPosition)}
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <Badge variant={g.role === 'primary' ? 'primary' : 'secondary'}>{grantRoleLabel(g)}</Badge>
              <Badge variant={grantStateVariant(g.state)}>{g.state}</Badge>
              <span class="text-sm font-mono break-all">{scopeLabel(g)}</span>
            </div>
            <dl class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
              <div><dt class="detail-label">Durability</dt><dd class="text-sm">{g.durability}</dd></div>
              <div><dt class="detail-label">Window</dt><dd class="text-sm tabular-nums">{g.windowSeconds} s</dd></div>
              <div><dt class="detail-label">Since</dt><dd class="text-sm" title={formatDate(new Date(g.sinceUnixMs))}>{formatRelative(new Date(g.sinceUnixMs))}</dd></div>
              <div><dt class="detail-label">Holder</dt><dd class="text-sm font-mono break-all">{g.sessionName || g.holderIp || '·'}</dd></div>
              <div><dt class="detail-label">Live</dt><dd class="text-sm">{liveLabel(result?.ownerReachable === false ? null : g.live)}</dd></div>
              <div><dt class="detail-label">Last renew</dt><dd class="text-sm tabular-nums">{formatClockMs(result?.ownerReachable === false ? null : g.lastRenewAgeMs)}</dd></div>
              <div><dt class="detail-label">Last seen</dt><dd class="text-sm tabular-nums">{formatClockMs(result?.ownerReachable === false ? null : g.lastSeenAgeMs)}</dd></div>
              <div><dt class="detail-label">Failover grace</dt><dd class="text-sm tabular-nums">{formatClockMs(result?.ownerReachable === false ? null : g.failoverGraceMs)}</dd></div>
              {#if g.fencedSinceUnixMs != null}
                <div><dt class="detail-label">Fenced since</dt><dd class="text-sm" title={formatDate(new Date(g.fencedSinceUnixMs))}>{formatRelative(new Date(g.fencedSinceUnixMs))}</dd></div>
              {/if}
            </dl>
            {#if g.takeOverText}
              <p class="text-sm">{g.takeOverText}</p>
            {/if}
          </div>
        {/each}

        {#if result?.truncated}
          <p class="text-sm text-warning" role="note">The list was cut short. More grants exist on this volume.</p>
        {/if}
        {#if grants.length > 0}
          <p class="text-sm text-muted-foreground">The grant is matched to this mount by holder address and name. A mount behind address translation can show no match.</p>
        {/if}
      </div>
    </div>
  {/if}
{/if}
