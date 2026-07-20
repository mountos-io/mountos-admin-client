<script lang="ts">
  import SystemMotion from '$lib/components/diagrams/SystemMotion.svelte'

  const facets = [
    {
      title: 'Control plane',
      body: 'Partner systems and the admin system drive the HUB through the SDK. The HUB owns the admin database and answers discovery. Clients resolve their volume there once per session.',
    },
    {
      title: 'Data plane',
      body: 'Metadata flows to the dataserv raft cluster, block reads and writes to the block storage members, and content chunks go directly to object storage.',
    },
    {
      title: 'Gateways',
      body: 'Apps without a mount reach the same data over S3 or WebHDFS, through the gateway a client exposes locally on 127.0.0.1 for a volume. There are no backend gateway services.',
    },
    {
      title: 'Durability',
      body: 'Object storage is the source of truth. Databases and vaults run highly available, and block storage members replicate as an active-active mesh.',
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
