<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { Button } from '$lib/components/ui/button'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import { EXPLAINERS, isExplainerTopic } from '$lib/components/explainers'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'

  // Static page mirror of the "How it works" modal, for mobile viewing.
  // Explainers describe operator internals; admins only.
  const auth = useAuth()
  $effect(() => {
    if (!auth.loading && auth.isUserRole) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  const topic = $derived($page.params.topic ?? '')
  const meta = $derived(isExplainerTopic(topic) ? EXPLAINERS[topic] : null)

  function back() {
    if (history.length > 1) history.back()
    else goto('/')
  }
</script>

<svelte:head><title>{meta ? meta.title : 'How it works'} · mountOS Admin</title></svelte:head>

<div class={`mx-auto space-y-5 p-4 sm:p-6 ${meta?.fullPage ? 'max-w-[1720px]' : 'max-w-3xl'}`}>
  {#if !meta}
    <h1 class="text-xl font-bold tracking-tight">How it works</h1>
    <p class="text-sm text-muted-foreground">Unknown topic.</p>
    <Button variant="outline" size="sm" onclick={back}>Go back</Button>
  {:else}
    {@const Explainer = meta.component}
    <div class="flex items-center gap-2">
      <Button variant="ghost" size="icon" class="min-h-[44px] min-w-[44px]" aria-label="Go back" onclick={back}>
        <ArrowLeft class="size-4" aria-hidden="true" />
      </Button>
      <h1 class="text-xl font-bold tracking-tight">{meta.title}</h1>
    </div>
    <p class="text-sm text-muted-foreground">{meta.description}</p>
    <Explainer />
  {/if}
</div>
