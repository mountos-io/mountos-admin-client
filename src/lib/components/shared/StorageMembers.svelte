<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import BlockStorageHelpDialog from '$lib/components/shared/BlockStorageHelpDialog.svelte'
  import { nodeStatusVariant } from '$lib/core/utils/format'
  import { api } from '$lib/core/stores/client.svelte'
  import { copyText } from '$lib/core/utils/clipboard'
  import { showSuccessToast, showErrorToast } from '$lib/core/utils/toast'
  import type { BlockVolume, ServiceNode } from '$lib/core/api/types'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'
  import ServerIcon from '@lucide/svelte/icons/server'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import Lightbulb from '@lucide/svelte/icons/lightbulb'

  let { storageId, regionId }: { storageId: number; regionId: number } = $props()

  let members = $state<BlockVolume[]>([])
  let nodesByVolume = $state<Map<string, ServiceNode[]>>(new Map())
  let loading = $state(true)
  let error = $state(false)
  let copied = $state<string | null>(null)
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  onDestroy(() => clearTimeout(copyTimer))

  $effect(() => {
    const ctrl = new AbortController()
    loading = true
    error = false
    Promise.all([
      api.storages.listBlockVolumes(storageId, ctrl.signal),
      // Associating members with their running blockserv is best-effort; a discovery
      // hiccup shouldn't blank the members list.
      api.serviceNodes
        .list(regionId, 'blockserv', undefined, undefined, undefined, ctrl.signal)
        .catch(() => [] as ServiceNode[]),
    ])
      .then(([bvs, nodes]) => {
        if (ctrl.signal.aborted) return
        members = bvs
        const map = new Map<string, ServiceNode[]>()
        for (const n of nodes) {
          const bvId = n.metadata?.['block_volume_id']
          if (typeof bvId !== 'string' || !bvId) continue
          const list = map.get(bvId) ?? []
          list.push(n)
          map.set(bvId, list)
        }
        nodesByVolume = map
      })
      .catch(() => { if (!ctrl.signal.aborted) error = true })
      .finally(() => { if (!ctrl.signal.aborted) loading = false })
    return () => ctrl.abort()
  })

  async function copy(value: string, label: string) {
    if (await copyText(value)) {
      copied = value
      showSuccessToast(`${label} copied`)
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => { if (copied === value) copied = null }, 1500)
    } else {
      showErrorToast('Copy failed: clipboard access blocked')
    }
  }

  function memberLabel(m: BlockVolume): string {
    return m.name || 'Block Volume'
  }
</script>

{#snippet envField(label: string, value: string, envVar: string)}
  <div class="space-y-1">
    <span class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>
    {#if value}
      <div class="flex items-center gap-2">
        <code class="text-sm font-mono truncate" title={value}>{value}</code>
        <button type="button" onclick={() => copy(value, label)}
          class="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-60 hover:opacity-100 hover:text-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-[color,opacity]"
          title={`Copy ${envVar}`} aria-label={`Copy ${label}`}>
          {#if copied === value}<CheckIcon class="size-3.5 text-primary" aria-hidden="true" />{:else}<CopyIcon class="size-3.5" aria-hidden="true" />{/if}
        </button>
        <Badge variant="secondary" class="font-mono text-[10px]">{envVar}</Badge>
      </div>
    {:else}
      <p class="text-sm text-muted-foreground">(not set)</p>
    {/if}
  </div>
{/snippet}

<Card cornerBrackets>
  <CardHeader>
    <div class="flex items-center gap-2">
      <CardTitle class="flex items-center gap-2">
        <ServerIcon class="size-4" aria-hidden="true" />
        Block Volume Members
        {#if !loading && !error}<Badge variant="outline">{members.length}</Badge>{/if}
      </CardTitle>
      <BlockStorageHelpDialog class="ml-auto" />
    </div>
  </CardHeader>
  <CardContent class="space-y-4">
    <div class="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
      <Lightbulb class="size-4 shrink-0 text-primary" aria-hidden="true" />
      <p>Each member runs a <span class="font-medium text-foreground">blockserv</span> configured with the
        <code class="font-mono">BLOCK_VOLUME_ID</code> and <code class="font-mono">REGION_CLUSTER_ID</code> shown below.
        Copy them into that process's environment to bring the member online.</p>
    </div>

    {#if loading}
      <p class="text-sm text-muted-foreground">Loading members…</p>
    {:else if error}
      <p class="text-sm text-destructive">Failed to load block volume members.</p>
    {:else if members.length === 0}
      <p class="text-sm text-muted-foreground">No block volume members provisioned for this storage.</p>
    {:else}
      <ul class="space-y-4">
        {#each members as m (m.id)}
          {@const servers = nodesByVolume.get(m.id) ?? []}
          <li class="rounded-lg border p-4 space-y-3">
            <div class="flex items-center gap-3">
              <span class="font-medium">{memberLabel(m)}</span>
              <span class="ml-auto"><StatusBadge active={m.isActive} /></span>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              {@render envField('Block Volume ID', m.id, 'BLOCK_VOLUME_ID')}
              {@render envField('Region Cluster', m.clusterUuid ?? '', 'REGION_CLUSTER_ID')}
            </div>

            <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Cluster:</span>
              <span class="font-medium text-foreground">{m.clusterName || '(not set)'}</span>
              {#if m.clusterReady}
                <Badge variant="outline" class="text-[10px]">ready</Badge>
              {:else if m.regionClusterId}
                <Badge variant="outline" class="text-[10px] text-destructive border-destructive/40">not ready</Badge>
              {/if}
            </div>

            <Separator />

            <div class="space-y-2">
              <span class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Serving blockserv</span>
              {#if servers.length === 0}
                <p class="text-sm text-muted-foreground">No blockserv registered for this member yet.</p>
              {:else}
                {#if servers.length > 1}
                  <div class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                    <TriangleAlert class="size-4 shrink-0" aria-hidden="true" />
                    <p>{servers.length} blockserv processes are serving this member. Each member should have exactly one. Verify you didn't start duplicates with the same <code class="font-mono">BLOCK_VOLUME_ID</code>.</p>
                  </div>
                {/if}
                <ul class="flex flex-wrap gap-2">
                  {#each servers as n (n.nodeId)}
                    <li>
                      <a href={`/nodes/${n.regionId}/${n.nodeId}`}
                        class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary transition-colors">
                        <span class="font-mono truncate max-w-[12rem]" title={n.nodeId}>{n.nodeId}</span>
                        <Badge variant={nodeStatusVariant(n.status)} class="text-[10px]">{n.status}</Badge>
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </CardContent>
</Card>
