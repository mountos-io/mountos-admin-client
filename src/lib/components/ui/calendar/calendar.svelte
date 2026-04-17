<script lang="ts">
  import { Calendar as CalendarPrimitive } from 'bits-ui'
  import type { DateValue } from '@internationalized/date'
  import ChevronLeft from '@lucide/svelte/icons/chevron-left'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import { cn } from '$lib/utils'

  let {
    value = $bindable(),
    placeholder = $bindable(),
    minValue,
    maxValue,
    onValueChange,
    class: className,
    weekdayFormat = 'short',
  }: {
    value?: DateValue
    placeholder?: DateValue
    minValue?: DateValue
    maxValue?: DateValue
    onValueChange?: (value: DateValue | undefined) => void
    class?: string
    weekdayFormat?: 'short' | 'long' | 'narrow'
  } = $props()

  const years = $derived.by<number[] | undefined>(() => {
    if (!minValue || !maxValue) return undefined
    const out: number[] = []
    for (let y = minValue.year; y <= maxValue.year; y++) out.push(y)
    return out
  })
</script>

<CalendarPrimitive.Root
  type="single"
  bind:value
  bind:placeholder
  {minValue}
  {maxValue}
  {onValueChange}
  {weekdayFormat}
  class={cn('p-3 select-none', className)}
>
  {#snippet children({ months, weekdays })}
    <CalendarPrimitive.Header class="flex items-center justify-between gap-2 pb-2">
      <CalendarPrimitive.PrevButton class="inline-flex h-7 w-7 pointer-coarse:h-9 pointer-coarse:w-9 items-center justify-center rounded-sm border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors">
        <ChevronLeft class="h-4 w-4" />
      </CalendarPrimitive.PrevButton>
      <div class="flex items-center gap-1">
        <CalendarPrimitive.MonthSelect
          monthFormat="short"
          class="bg-transparent text-sm font-semibold tracking-wide cursor-pointer outline-none hover:text-primary focus:text-primary appearance-none px-1 rounded-sm"
        />
        <CalendarPrimitive.YearSelect
          years={years}
          class="bg-transparent text-sm font-semibold tabular-nums cursor-pointer outline-none hover:text-primary focus:text-primary appearance-none px-1 rounded-sm"
        />
      </div>
      <CalendarPrimitive.NextButton class="inline-flex h-7 w-7 pointer-coarse:h-9 pointer-coarse:w-9 items-center justify-center rounded-sm border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors">
        <ChevronRight class="h-4 w-4" />
      </CalendarPrimitive.NextButton>
    </CalendarPrimitive.Header>
    {#each months as month}
      <CalendarPrimitive.Grid class="w-full border-collapse">
        <CalendarPrimitive.GridHead>
          <CalendarPrimitive.GridRow class="flex w-full">
            {#each weekdays as day}
              <CalendarPrimitive.HeadCell class="w-8 pointer-coarse:w-10 text-[0.65rem] uppercase tracking-wider font-medium text-muted-foreground/70 text-center">
                {day.slice(0, 2)}
              </CalendarPrimitive.HeadCell>
            {/each}
          </CalendarPrimitive.GridRow>
        </CalendarPrimitive.GridHead>
        <CalendarPrimitive.GridBody>
          {#each month.weeks as week}
            <CalendarPrimitive.GridRow class="flex w-full mt-0.5">
              {#each week as date}
                <CalendarPrimitive.Cell {date} month={month.value} class="p-0 text-center">
                  <CalendarPrimitive.Day
                    class={cn(
                      'inline-flex h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10 items-center justify-center rounded-sm text-sm tabular-nums',
                      'text-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
                      'data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:font-semibold',
                      'data-[outside-month]:text-muted-foreground/40 data-[outside-month]:pointer-events-none',
                      'data-[unavailable]:text-muted-foreground/30 data-[unavailable]:line-through data-[unavailable]:pointer-events-none',
                      'data-[disabled]:opacity-30 data-[disabled]:pointer-events-none',
                      'data-[today]:ring-1 data-[today]:ring-primary/60'
                    )}
                  />
                </CalendarPrimitive.Cell>
              {/each}
            </CalendarPrimitive.GridRow>
          {/each}
        </CalendarPrimitive.GridBody>
      </CalendarPrimitive.Grid>
    {/each}
  {/snippet}
</CalendarPrimitive.Root>
