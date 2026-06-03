<script lang="ts">
  import { cn } from '$lib/utils.js'
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import Check from '@lucide/svelte/icons/check'

  type Props = {
    options: { value: string; label: string }[]
    value?: string
    placeholder?: string
    id?: string
    disabled?: boolean
    class?: string
    onchange?: (value: string) => void
  }

  let {
    options, value = $bindable(''), placeholder,
    id, disabled = false, class: className, onchange,
  }: Props = $props()

  let open = $state(false)
  const selectedLabel = $derived(options.find(o => o.value === value)?.label ?? '')
</script>

<Popover bind:open>
  <PopoverTrigger {disabled}>
    {#snippet child({ props })}
      <button {...props} {id} type="button" aria-label={placeholder || 'Select option'}
        aria-haspopup="listbox" aria-expanded={open}
        class={cn(
          "border-input bg-background dark:bg-input/20 ring-offset-background flex h-9 w-full items-center justify-between rounded-sm border px-3 py-1 text-base outline-none transition-[border-color] md:text-sm",
          "focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground",
          className
        )}>
        <span class="truncate">{selectedLabel || placeholder || ''}</span>
        <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
      </button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent class="w-[--bits-popover-anchor-width] min-w-36 p-1" align="start">
    <div role="listbox" aria-label={placeholder || 'Select option'}>
      {#each options as opt}
        <button type="button"
          role="option"
          aria-selected={opt.value === value}
          class={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none cursor-pointer",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:bg-accent focus-visible:text-accent-foreground",
            opt.value === value && "bg-accent/50"
          )}
          onclick={() => { value = opt.value; open = false; onchange?.(opt.value) }}
        >
          <Check class={cn("h-4 w-4 shrink-0", opt.value === value ? "opacity-100" : "opacity-0")} aria-hidden="true" />
          <span class="truncate">{opt.label}</span>
        </button>
      {/each}
    </div>
  </PopoverContent>
</Popover>
