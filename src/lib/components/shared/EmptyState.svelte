<script lang="ts">
  let { title, description, action }: {
    title: string
    description?: string
    action?: { label: string; href: string }
  } = $props()
</script>

<section aria-labelledby="empty-heading" class="flex flex-col items-center justify-center py-8 sm:py-16 text-center">
  <div class="empty-bracket relative px-10 py-6">
    <h2 id="empty-heading" class="text-sm tracking-widest text-muted-foreground/60 font-medium uppercase">[ {title.toLowerCase()} ]</h2>
  </div>
  {#if description}
    <p class="mt-3 text-base text-muted-foreground/80 max-w-xs">{description}</p>
  {/if}
  {#if action}
    <a
      href={action.href}
      class="mt-4 inline-flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
    >
      {action.label}
    </a>
  {/if}
</section>

<style>
  .empty-bracket::before,
  .empty-bracket::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-color: var(--color-muted-foreground);
    opacity: 0.25;
  }
  .empty-bracket::before {
    top: 0;
    left: 0;
    border-top: 1px solid;
    border-left: 1px solid;
  }
  .empty-bracket::after {
    bottom: 0;
    right: 0;
    border-bottom: 1px solid;
    border-right: 1px solid;
  }
</style>
