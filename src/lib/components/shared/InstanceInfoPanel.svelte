<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { copyText } from '$lib/core/utils/clipboard'
  import { formatDate } from '$lib/core/utils/format'
  import Copy from '@lucide/svelte/icons/copy'
  import Check from '@lucide/svelte/icons/check'

  let { info }: { info: Record<string, unknown> } = $props()

  type Entry = { key: string; label: string; text: string; mono?: boolean; copy?: boolean; wide?: boolean }
  type Group = { title: string; entries: Entry[] }

  const LABELS: Record<string, string> = {
    cloud: 'Cloud',
    instanceId: 'Instance ID',
    instanceType: 'Instance Type',
    imageId: 'Image',
    region: 'Region',
    zone: 'Zone',
    hostname: 'Hostname',
    publicIp: 'Public IP',
    privateIps: 'Private IPs',
    accountId: 'Account',
    vpcId: 'VPC',
    subnetId: 'Subnet ID',
    subnet: 'Subnet',
    mac: 'MAC',
    network: 'Network',
    resourceGroup: 'Resource Group',
    dbType: 'DB Type',
    dbHost: 'DB Host',
    dbProvider: 'DB Provider',
    vaultProvider: 'Vault Provider',
    vaultHost: 'Vault Host',
    verified: 'Verified',
    productCodes: 'Product Codes',
  }
  const CLOUD_LABELS: Record<string, string> = {
    aws: 'AWS',
    gcp: 'Google Cloud',
    azure: 'Azure',
    digitalocean: 'DigitalOcean',
    oci: 'Oracle Cloud',
    hetzner: 'Hetzner',
  }
  // Keys with dedicated groups below; everything else lands in Details.
  const GROUPED_KEYS = new Set([
    'cloud', 'instanceId', 'instanceType', 'imageId', 'region', 'zone',
    'hostname', 'publicIp', 'privateIps', 'network', 'securityGroups',
    'accountId', 'mountos', 'marketplace', 'extra', 'capturedAt',
  ])

  function humanize(key: string): string {
    return LABELS[key] ?? key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function asText(v: unknown): string {
    if (Array.isArray(v)) return v.map(String).join(', ')
    if (v && typeof v === 'object') return JSON.stringify(v)
    return String(v ?? '')
  }

  // Long opaque identifiers get mono + copy; short scalars stay plain text.
  function entry(key: string, v: unknown): Entry {
    const text = asText(v)
    const mono = /id$|ip|mac|subnet|image|host/i.test(key) || text.length > 24
    return { key, label: humanize(key), text, mono, copy: mono && text.length > 8, wide: text.length > 40 }
  }

  function entriesOf(obj: unknown, prefix: string): Entry[] {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return []
    return Object.entries(obj as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && asText(v) !== '')
      .map(([k, v]) => ({ ...entry(k, v), key: `${prefix}.${k}` }))
  }

  function pick(keys: string[]): Entry[] {
    return keys
      .filter((k) => info[k] !== undefined && info[k] !== null && asText(info[k]) !== '')
      .map((k) => entry(k, info[k]))
  }

  const cloudLabel = $derived(CLOUD_LABELS[String(info.cloud ?? '')] ?? String(info.cloud ?? ''))
  // Dedupe so the keyed each below cannot crash on repeated names (an AWS
  // instance with several ENIs in the same group reports it once per ENI).
  const securityGroups = $derived(Array.isArray(info.securityGroups) ? [...new Set(info.securityGroups.map(String))] : [])
  const capturedAt = $derived(typeof info.capturedAt === 'number' ? info.capturedAt : null)

  const groups = $derived.by<Group[]>(() => {
    const rest = Object.keys(info)
      .filter((k) => !GROUPED_KEYS.has(k))
      .sort()
      .map((k) => entry(k, info[k]))
    const all: Group[] = [
      { title: 'Identity', entries: pick(['instanceId', 'instanceType', 'imageId']) },
      { title: 'Placement', entries: pick(['region', 'zone']) },
      {
        title: 'Network',
        entries: [...pick(['hostname', 'publicIp', 'privateIps']), ...entriesOf(info.network, 'network')],
      },
      { title: 'Account', entries: pick(['accountId']) },
      { title: 'mountOS', entries: entriesOf(info.mountos, 'mountos') },
      { title: 'Marketplace', entries: entriesOf(info.marketplace, 'marketplace') },
      { title: 'Details', entries: [...entriesOf(info.extra, 'extra'), ...rest] },
    ]
    return all.filter((g) => g.entries.length > 0)
  })

  let copiedKey = $state('')
  let copyTimer: ReturnType<typeof setTimeout>
  async function copy(key: string, text: string) {
    if (await copyText(text)) {
      copiedKey = key
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => { copiedKey = '' }, 1500)
    }
  }
  // Entry keys are stable across nodes (instanceId, region, ...), so a swap of
  // the info prop must drop any in-flight copied indicator.
  $effect(() => {
    void info
    clearTimeout(copyTimer)
    copiedKey = ''
  })
  onDestroy(() => clearTimeout(copyTimer))
</script>

<Card>
  <CardHeader>
    <div class="flex items-center justify-between gap-2">
      <CardTitle class="text-base">Instance Info</CardTitle>
      {#if cloudLabel}
        <Badge variant="outline" class="uppercase tracking-wide">{cloudLabel}</Badge>
      {/if}
    </div>
  </CardHeader>
  <CardContent class="pt-0 space-y-5">
    {#each groups as g (g.title)}
      <section aria-label={g.title}>
        <h3 class="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground mb-2">{g.title}</h3>
        <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {#each g.entries as e (e.key)}
            <div class={e.wide ? 'col-span-full' : ''}>
              <dt class="text-muted-foreground text-sm">{e.label}</dt>
              <dd class="mt-0.5">
                {#if e.copy}
                  <div class="flex items-center gap-1.5">
                    <code class="font-mono text-sm break-all">{e.text}</code>
                    <Button
                      variant="ghost" size="icon" class="h-6 w-6 min-h-[44px] min-w-[44px] sm:min-h-6 sm:min-w-6 shrink-0"
                      aria-label={copiedKey === e.key ? `${e.label} copied` : `Copy ${e.label}`}
                      onclick={() => copy(e.key, e.text)}
                    >
                      {#if copiedKey === e.key}
                        <Check class="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {:else}
                        <Copy class="h-3.5 w-3.5" aria-hidden="true" />
                      {/if}
                    </Button>
                  </div>
                {:else if e.mono}
                  <span class="font-mono text-sm">{e.text}</span>
                {:else}
                  <span class="text-sm">{e.text}</span>
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}

    {#if securityGroups.length > 0}
      <section aria-label="Security Groups">
        <h3 class="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground mb-2">Security Groups</h3>
        <div class="flex flex-wrap gap-1.5">
          {#each securityGroups as sg (sg)}
            <Badge variant="secondary" class="font-mono">{sg}</Badge>
          {/each}
        </div>
      </section>
    {/if}

    {#if groups.length === 0 && securityGroups.length === 0}
      <p class="text-sm text-muted-foreground">No instance details reported.</p>
    {/if}

    {#if capturedAt}
      <p class="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground">
        Captured {formatDate(capturedAt)}
      </p>
    {/if}
  </CardContent>
</Card>
