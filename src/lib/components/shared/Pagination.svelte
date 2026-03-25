<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  let { currentPage, totalPages, onPageChange }: {
    currentPage: number; totalPages: number; onPageChange: (page: number) => void
  } = $props()

  function handlePrevKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = e.currentTarget as HTMLElement
      ;(next.nextElementSibling?.nextElementSibling as HTMLElement | null)?.focus()
    }
  }

  function handleNextKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = e.currentTarget as HTMLElement
      ;(prev.previousElementSibling?.previousElementSibling as HTMLElement | null)?.focus()
    }
  }
</script>

{#if totalPages > 1}
  <nav aria-label="Pagination" class="flex items-center justify-center gap-2 py-4">
    <Button variant="outline" size="sm" disabled={currentPage <= 1} onclick={() => onPageChange(currentPage - 1)} onkeydown={handlePrevKey} aria-label="Go to previous page">
      Previous
    </Button>
    <span class="text-sm text-muted-foreground" role="status" aria-live="polite">Page {currentPage} of {totalPages}</span>
    <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onclick={() => onPageChange(currentPage + 1)} onkeydown={handleNextKey} aria-label="Go to next page">
      Next
    </Button>
  </nav>
{/if}
