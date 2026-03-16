<script lang="ts">
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import CheckCircle from '@lucide/svelte/icons/check-circle'
  import XCircle from '@lucide/svelte/icons/x-circle'
  import FlaskConical from '@lucide/svelte/icons/flask-conical'
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle'
  import Loader2 from '@lucide/svelte/icons/loader-2'

  let {
    endpoint, region = '', bucket, accessKey, secretKey,
    providerType = '', disabled = false, onresult,
  }: {
    endpoint: string
    region?: string
    bucket: string
    accessKey: string
    secretKey: string
    providerType?: string
    disabled?: boolean
    onresult?: (passed: boolean) => void
  } = $props()

  const store = useStorages()

  type TestResult = { bucketExists: boolean; list: boolean; write: boolean; read: boolean; delete: boolean; multipart: boolean }

  let testing = $state(false)
  let result = $state<TestResult | null>(null)
  let error = $state('')
  let testGeneration = $state(0)

  const TEST_ITEMS: { key: keyof TestResult; label: string }[] = [
    { key: 'bucketExists', label: 'Bucket Access' },
    { key: 'list', label: 'List Objects' },
    { key: 'write', label: 'Write Access' },
    { key: 'read', label: 'Read Access' },
    { key: 'delete', label: 'Delete Access' },
    { key: 'multipart', label: 'Multipart Upload' },
  ]

  const fingerprint = $derived(`${endpoint}|${region}|${bucket}|${accessKey}|${secretKey}|${providerType}`)
  let lastFingerprint = $state('')
  let mounted = $state(false)

  $effect(() => {
    if (fingerprint !== lastFingerprint) {
      lastFingerprint = fingerprint
      if (mounted) {
        result = null
        error = ''
        testGeneration++
        onresult?.(false)
      }
      mounted = true
    }
  })

  const passed = $derived(result ? Object.values(result).every(Boolean) : false)
  const successCount = $derived(result ? Object.values(result).filter(Boolean).length : 0)

  async function runTest() {
    const gen = ++testGeneration
    testing = true
    error = ''
    result = null
    try {
      const res = await store.testBucket({
        endpoint, region: region || undefined, bucket, accessKey, secretKey,
        providerType: providerType || undefined,
      })
      if (gen !== testGeneration) return
      result = res
      onresult?.(Object.values(res).every(Boolean))
    } catch (e: unknown) {
      if (gen !== testGeneration) return
      error = e instanceof Error ? e.message : 'Test failed'
      onresult?.(false)
    } finally {
      if (gen === testGeneration) testing = false
    }
  }
</script>

<div class="space-y-3">
  <Separator />
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <FlaskConical class="h-4 w-4 text-muted-foreground" />
      <span class="text-sm font-medium">Bucket Verification</span>
    </div>
    {#if result}
      <Badge variant={passed ? 'default' : successCount > 0 ? 'secondary' : 'destructive'}>
        {successCount}/{TEST_ITEMS.length} passed
      </Badge>
    {/if}
  </div>

  {#if error}
    <div class="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3" role="alert">
      <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <span class="text-sm text-destructive">{error}</span>
    </div>
  {/if}

  {#if result}
    <div class="grid gap-1">
      {#each TEST_ITEMS as item}
        {@const ok = result[item.key]}
        <div class="flex items-center gap-2 rounded px-2 py-1 text-sm">
          {#if ok}
            <CheckCircle class="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          {:else}
            <XCircle class="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          {/if}
          <span class:text-muted-foreground={!ok}>{item.label}</span>
        </div>
      {/each}
    </div>
  {/if}

  <Button
    variant="outline"
    class="w-full"
    disabled={disabled || testing}
    onclick={runTest}
  >
    {#if testing}
      <Loader2 class="h-4 w-4 animate-spin" />
    {:else}
      <FlaskConical class="h-4 w-4" />
    {/if}
    {testing ? 'Testing...' : result ? 'Retest Bucket' : 'Test Bucket'}
  </Button>
</div>
