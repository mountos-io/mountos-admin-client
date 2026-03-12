<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  let { currentPage, totalPages, onPageChange }: {
    currentPage: number; totalPages: number; onPageChange: (page: number) => void
  } = $props()
</script>

{#if totalPages > 1}
  <nav aria-label="Pagination" class="flex items-center justify-center gap-2 py-4">
    <Button variant="outline" size="sm" disabled={currentPage <= 1} onclick={() => onPageChange(currentPage - 1)}>
      Previous
    </Button>
    <span class="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
    <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onclick={() => onPageChange(currentPage + 1)}>
      Next
    </Button>
  </nav>
{/if}
