<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  let { currentPage, totalPages, onPageChange }: {
    currentPage: number; totalPages: number; onPageChange: (page: number) => void
  } = $props()

  let prevRef = $state<HTMLElement | null>(null)
  let nextRef = $state<HTMLElement | null>(null)

  function handlePrevKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); nextRef?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); onPageChange(1) }
    else if (e.key === 'End') { e.preventDefault(); onPageChange(totalPages) }
  }

  function handleNextKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevRef?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); onPageChange(1) }
    else if (e.key === 'End') { e.preventDefault(); onPageChange(totalPages) }
  }
</script>

{#if totalPages > 1}
  <nav aria-label="Pagination" class="flex items-center justify-center gap-1 sm:gap-2 py-4">
    <span bind:this={prevRef}>
      <Button variant="outline" size="sm" disabled={currentPage <= 1} onclick={() => onPageChange(currentPage - 1)} onkeydown={handlePrevKey} aria-label="Go to previous page">
        Previous
      </Button>
    </span>
    <span class="text-xs sm:text-sm text-muted-foreground" role="status" aria-live="polite">Page {currentPage} of {totalPages}</span>
    <span bind:this={nextRef}>
      <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onclick={() => onPageChange(currentPage + 1)} onkeydown={handleNextKey} aria-label="Go to next page">
        Next
      </Button>
    </span>
  </nav>
{/if}
