<script lang="ts">
  import { Card, CardHeader, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Skeleton } from '$lib/components/ui/skeleton'

  let {
    fields = 4,
    title = true,
    actions = true,
    cornerBrackets = true,
  }: {
    fields?: number
    title?: boolean
    actions?: boolean
    cornerBrackets?: boolean
  } = $props()
</script>

<Card {cornerBrackets} role="status" aria-busy="true" aria-label="Loading form">
  {#if title}
    <CardHeader><Skeleton class="h-5 w-40" /></CardHeader>
  {/if}
  <CardContent class="space-y-5">
    {#each { length: fields } as _, i (i)}
      <div class="space-y-2">
        <Skeleton class="h-3 w-24" />
        <Skeleton class="h-9 w-full" />
      </div>
    {/each}
  </CardContent>
  {#if actions}
    <CardFooter class="gap-3">
      <Skeleton class="h-9 w-24" />
      <Skeleton class="h-9 w-20" />
    </CardFooter>
  {/if}
</Card>
