<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import BookOpen from '@lucide/svelte/icons/book-open'
  import { EXPLAINERS, explainerHref, type ExplainerTopic } from '$lib/components/explainers'
  import { useAuth } from '$lib/core/stores/auth.svelte'

  // Desktop opens the explainer in a modal; mobile navigates to the static page
  // (a zoomable diagram is cramped in a small modal). Same content either way.
  let { topic, variant = 'outline', class: className = '' }:
    { topic: ExplainerTopic; variant?: 'outline' | 'ghost'; class?: string } = $props()

  // Explainers describe operator internals; admins only.
  const auth = useAuth()
  const meta = $derived(EXPLAINERS[topic])
</script>

{#if auth.isUserRole}
  <!-- hidden for the regular user role -->
{:else if meta.fullPage}
  <!-- Dense diagrams get the full page on every viewport -->
  <Button href={explainerHref(topic)} {variant} size="sm"
    class={`gap-1.5 shrink-0 min-h-[44px] sm:min-h-8 ${className}`}>
    <BookOpen class="size-4" aria-hidden="true" /> How it works
  </Button>
{:else}
  <!-- Mobile: real link to the static page -->
  <Button href={explainerHref(topic)} {variant} size="sm"
    class={`gap-1.5 shrink-0 inline-flex sm:hidden min-h-[44px] ${className}`}>
    <BookOpen class="size-4" aria-hidden="true" /> How it works
  </Button>

  <!-- Desktop: modal -->
  <Dialog.Root>
    <Dialog.Trigger>
      {#snippet child({ props })}
        <Button {...props} {variant} size="sm" type="button"
          class={`gap-1.5 shrink-0 hidden sm:inline-flex ${className}`}>
          <BookOpen class="size-4" aria-hidden="true" /> How it works
        </Button>
      {/snippet}
    </Dialog.Trigger>
    <Dialog.Content class="sm:max-w-5xl w-full">
      {@const Explainer = meta.component}
      <Dialog.Title class="text-base font-semibold">{meta.title}</Dialog.Title>
      <Dialog.Description class="text-sm text-muted-foreground">{meta.description}</Dialog.Description>
      <Explainer />
    </Dialog.Content>
  </Dialog.Root>
{/if}
