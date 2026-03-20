<script lang="ts">
  import { cn } from '$lib/utils.js'
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover'
  import { Button } from '$lib/components/ui/button'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import Check from '@lucide/svelte/icons/check'

  let {
    options, value = $bindable(''), placeholder = 'Select...',
    onchange, class: className,
  }: {
    options: readonly { value: string; label: string }[]
    value?: string
    placeholder?: string
    onchange?: (value: string) => void
    class?: string
  } = $props()

  let open = $state(false)
  const selectedLabel = $derived(options.find(o => o.value === value)?.label ?? '')
</script>

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="sm"
        class={cn(
          "justify-between gap-1.5 min-w-24",
          value ? "font-semibold" : "font-normal text-muted-foreground",
          className
        )}>
        <span class="truncate">{selectedLabel || placeholder}</span>
        <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
      </Button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent class="w-[--bits-popover-anchor-width] min-w-36 p-1" align="start">
    {#each options as opt}
      <button
        type="button"
        class={cn(
          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none cursor-pointer",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:bg-accent focus-visible:text-accent-foreground",
          opt.value === value && "bg-accent/50"
        )}
        onclick={() => { value = opt.value; open = false; onchange?.(opt.value) }}
      >
        <Check class={cn("h-4 w-4 shrink-0", opt.value === value ? "opacity-100" : "opacity-0")} />
        <span class="truncate">{opt.label}</span>
      </button>
    {/each}
  </PopoverContent>
</Popover>
