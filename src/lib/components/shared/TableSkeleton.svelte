<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Table, TableHeader, TableBody, TableRow, TableCell } from '$lib/components/ui/table'
  import { Skeleton } from '$lib/components/ui/skeleton'

  type Cell = { width: string; class?: string; height?: string }

  let {
    header,
    cells,
    rows = 5,
    caption = 'Loading',
  }: {
    header: Snippet
    cells: Cell[]
    rows?: number
    caption?: string
  } = $props()
</script>

<div role="status" aria-busy="true" aria-label={caption}>
  <Table>
    <caption class="sr-only">{caption}</caption>
    <TableHeader>
      {@render header()}
    </TableHeader>
    <TableBody aria-hidden="true">
      {#each { length: rows } as _, r (r)}
        <TableRow>
          {#each cells as cell, c (c)}
            <TableCell class={cell.class}>
              <Skeleton class="{cell.height ?? 'h-4'} {cell.width}" />
            </TableCell>
          {/each}
        </TableRow>
      {/each}
    </TableBody>
  </Table>
</div>
