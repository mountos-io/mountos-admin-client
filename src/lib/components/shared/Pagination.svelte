<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  let { currentPage, totalPages, onPageChange }: {
    currentPage: number; totalPages: number; onPageChange: (page: number) => void
  } = $props()

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' && currentPage > 1) {
      e.preventDefault(); onPageChange(currentPage - 1)
    } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
      e.preventDefault(); onPageChange(currentPage + 1)
    }
  }
</script>

{#if totalPages > 1}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <nav aria-label="Pagination" class="flex items-center justify-center gap-2 py-4" onkeydown={handleKeydown}>
    <Button variant="outline" size="sm" disabled={currentPage <= 1} onclick={() => onPageChange(currentPage - 1)} aria-label="Go to previous page">
      Previous
    </Button>
    <span class="text-sm text-muted-foreground" role="status" aria-live="polite">Page {currentPage} of {totalPages}</span>
    <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onclick={() => onPageChange(currentPage + 1)} aria-label="Go to next page">
      Next
    </Button>
  </nav>
{/if}
