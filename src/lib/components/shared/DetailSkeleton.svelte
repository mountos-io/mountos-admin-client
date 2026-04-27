<script lang="ts">
  import { Card, CardHeader, CardContent } from '$lib/components/ui/card'
  import { Skeleton } from '$lib/components/ui/skeleton'

  type CardSpec = {
    rows?: number
    cols?: 1 | 2 | 3
    cornerBrackets?: boolean
    title?: boolean
  }

  let {
    cards = [{ rows: 4, cols: 1, cornerBrackets: true, title: true }],
    gridCols = 1,
    class: className,
  }: {
    cards?: CardSpec[]
    gridCols?: 1 | 2
    class?: string
  } = $props()

  const gridClass = $derived(gridCols === 2 ? 'grid gap-6 md:grid-cols-2' : 'grid gap-6')
</script>

<div class="{gridClass} {className ?? ''}" role="status" aria-busy="true" aria-label="Loading details">
  {#each cards as card, i (i)}
    {@const cols = card.cols ?? 1}
    {@const rows = card.rows ?? 4}
    {@const colsClass = cols === 3 ? 'sm:grid-cols-3' : cols === 2 ? 'sm:grid-cols-2' : ''}
    <Card cornerBrackets={card.cornerBrackets ?? true}>
      {#if card.title ?? true}
        <CardHeader>
          <Skeleton class="h-5 w-32" />
        </CardHeader>
      {/if}
      <CardContent class="space-y-4">
        <div class="grid gap-x-6 gap-y-4 grid-cols-1 {colsClass}">
          {#each { length: rows * cols } as _, r (r)}
            <div class="space-y-2">
              <Skeleton class="h-3 w-20" />
              <Skeleton class="h-4 w-3/4" />
            </div>
          {/each}
        </div>
      </CardContent>
    </Card>
  {/each}
</div>
