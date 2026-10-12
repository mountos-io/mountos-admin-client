<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { api } from '$lib/core/stores/client.svelte'
  import type { MountDetails, MountReportResponse } from '$lib/core/api/types'
  import { classifyFailure, commandLine, flagsAsText, hasReportContent, sortFlags, type LoadFailure } from '$lib/core/utils/exclusive'
  import { copyText } from '$lib/core/utils/clipboard'
  import { downloadTextFile } from '$lib/core/utils/download'
  import { showErrorToast, showSuccessToast } from '$lib/core/utils/toast'
  import { formatRelative } from '$lib/core/utils/format'
  import Copy from '@lucide/svelte/icons/copy'
  import Download from '@lucide/svelte/icons/download'
  import LoaderCircle from '@lucide/svelte/icons/loader-circle'

  let { sessionId, onloaded }: {
    sessionId: number
    onloaded?: (mount: MountDetails | null) => void
  } = $props()

  let report = $state<MountReportResponse | null>(null)
  let loading = $state(true)
  let failure = $state<LoadFailure | null>(null)
  let downloading = $state(false)
  let ctrl: AbortController | null = null

  const mount = $derived(report?.mount ?? null)
  const hasContent = $derived(hasReportContent(mount))
  const flags = $derived(sortFlags(mount?.flags))
  const cmd = $derived(mount ? commandLine(mount) : '')

  async function load(id: number) {
    ctrl?.abort()
    const c = ctrl = new AbortController()
    loading = true
    failure = null
    try {
      const r = await api.clientSessions.mountReport(id, c.signal)
      if (ctrl !== c) return
      report = r
      onloaded?.(r.mount ?? null)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      if (ctrl !== c) return
      report = null
      failure = classifyFailure(e)
      onloaded?.(null)
    } finally {
      if (ctrl === c) loading = false
    }
  }

  $effect(() => {
    const id = sessionId
    load(id)
  })

  onDestroy(() => ctrl?.abort())

  async function copy(text: string, what: string) {
    if (await copyText(text)) showSuccessToast(`${what} copied`)
    else showErrorToast('Failed to copy')
  }

  async function downloadBundle() {
    downloading = true
    try {
      const bundle = await api.clientSessions.supportBundle(sessionId)
      downloadTextFile(`support-bundle-${sessionId}.json`, JSON.stringify(bundle, null, 2), 'application/json')
    } catch (e) {
      const f = classifyFailure(e)
      showErrorToast(f === 'forbidden' ? 'Your role cannot download support bundles' : 'Failed to download the support bundle')
    } finally {
      downloading = false
    }
  }
</script>

<div class="corner-brackets relative border border-border/30 rounded-sm">
  <div class="tech-grid absolute inset-0 pointer-events-none"></div>
  <div class="relative p-5 space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-lg font-semibold">How it was mounted</h2>
      {#if report?.ageSeconds != null && !failure}
        <span class="text-sm text-muted-foreground">Reported {formatRelative(new Date(Date.now() - report.ageSeconds * 1000))}</span>
      {/if}
      <Button
        variant="outline"
        size="sm"
        class="ml-auto min-h-[44px] sm:min-h-8"
        onclick={downloadBundle}
        disabled={downloading || failure === 'forbidden'}
        aria-busy={downloading}
      >
        {#if downloading}<LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" />{:else}<Download class="h-4 w-4" aria-hidden="true" />{/if}
        Download support bundle
      </Button>
    </div>

    {#if loading && !report}
      <p class="text-sm text-muted-foreground" role="status">Loading mount report</p>
    {:else if failure === 'forbidden'}
      <p class="text-sm text-muted-foreground">Your role cannot read mount reports.</p>
    {:else if failure === 'not-found'}
      <p class="text-sm text-muted-foreground">The server has no record of this session.</p>
    {:else if failure}
      <div role="alert" class="flex flex-wrap items-center gap-3 text-sm text-destructive">
        <span>The mount report could not be loaded.</span>
        <Button variant="outline" size="sm" class="min-h-[44px] sm:min-h-8" onclick={() => load(sessionId)}>Retry</Button>
      </div>
    {:else if !hasContent}
      <p class="text-sm text-muted-foreground">
        The client did not send a mount report. It may be an older client, or it was started with <code class="font-mono">--no-mount-report</code>.
      </p>
    {:else if mount}
      <div class="space-y-1">
        <div class="flex items-center gap-1">
          <p class="detail-label mb-0">Command line</p>
          <Button variant="ghost" size="icon" class="min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8" onclick={() => copy(cmd, 'Command line')} aria-label="Copy command line" title="Copy command line">
            <Copy class="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <pre class="text-sm font-mono whitespace-pre-wrap break-all rounded-sm bg-muted/40 px-3 py-2">{cmd}</pre>
        <p class="text-sm text-muted-foreground">Rebuilt from the stored report. Flags are sorted by name. Values that look like secrets are never stored.</p>
      </div>

      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {#if mount.mountPoint}
          <div class="min-w-0"><dt class="detail-label">Mount point</dt><dd class="text-sm font-mono break-all">{mount.mountPoint}</dd></div>
        {/if}
        {#if mount.args?.length}
          <div class="min-w-0">
            <dt class="detail-label">Arguments</dt>
            <dd class="text-sm font-mono break-all">{mount.args.join(' ')}</dd>
          </div>
        {/if}
        {#if mount.mountOptions?.length}
          <div class="min-w-0 sm:col-span-2">
            <dt class="detail-label">Mount options (-o)</dt>
            <dd class="text-sm font-mono break-all">{mount.mountOptions.join(', ')}</dd>
          </div>
        {/if}
      </dl>

      {#if flags.length > 0}
        <div class="space-y-1">
          <div class="flex items-center gap-1">
            <p class="detail-label mb-0">Flags ({flags.length})</p>
            <Button variant="ghost" size="icon" class="min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8" onclick={() => copy(flagsAsText(flags), 'Flags')} aria-label="Copy all flags" title="Copy all flags">
              <Copy class="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Table containerLabel="Mount flags">
            <TableHeader>
              <TableRow>
                <TableHead class="th-cyber">Name</TableHead>
                <TableHead class="th-cyber">Value</TableHead>
                <TableHead class="th-cyber hidden sm:table-cell">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each flags as f (f.name + '=' + f.value)}
                <TableRow>
                  <TableCell class="text-sm font-mono align-top break-all">{f.name}</TableCell>
                  <TableCell class="text-sm font-mono align-top break-all">{f.value === '' ? '·' : f.value}</TableCell>
                  <TableCell class="text-sm text-muted-foreground hidden sm:table-cell align-top">{f.source ?? '·'}</TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>
        </div>
      {/if}

      {#if mount.truncated}
        <p class="text-sm text-warning" role="note">The report was cut short. Some flags or arguments are missing.</p>
      {/if}
    {/if}
  </div>
</div>
