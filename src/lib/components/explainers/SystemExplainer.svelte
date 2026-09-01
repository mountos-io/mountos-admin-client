<script lang="ts">
  import SystemMotion from '$lib/components/diagrams/SystemMotion.svelte'

  const facets = [
    {
      title: 'Control plane',
      body: 'Partner systems and the admin system drive the HUB through the SDK. The HUB owns the admin database and answers discovery. Clients resolve their volume there once per session.',
    },
    {
      title: 'Data plane',
      body: 'Metadata flows to the dataserv metadata cluster, block reads and writes go to the resolved copyset, and content chunks go directly to object storage.',
    },
    {
      title: 'Copyset servers',
      body: 'A copyset is two blockserv nodes, each with its own SSD. The two nodes sync directly, with no primary. A volume draws its own working set of copysets, not the whole fleet, so volumes often share one.',
    },
    {
      title: 'Gateways',
      body: 'Apps without a mount reach the same data over S3 or WebHDFS, through the gateway a client exposes locally on 127.0.0.1 for a volume.',
    },
    {
      title: 'Durability',
      body: 'Object storage is the source of truth. Databases and vaults run highly available, and each block volume replicates through 2-node copysets.',
    },
  ]
</script>

<div class="space-y-4">
  <SystemMotion />

  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {#each facets as facet (facet.title)}
      <div class="rounded-lg border bg-card p-4">
        <div class="text-sm font-semibold text-foreground">{facet.title}</div>
        <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{facet.body}</p>
      </div>
    {/each}
  </div>
</div>
