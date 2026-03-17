<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'

  let { title, value, subtitle, class: className }: {
    title: string
    value: string | number
    subtitle?: string
    class?: string
  } = $props()
</script>

<Card cornerPlus class={className}>
  <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
  <CardContent>
    <p class="text-3xl font-bold">{value}</p>
    {#if subtitle}
      <p class="text-sm text-muted-foreground mt-1">{subtitle}</p>
    {/if}
  </CardContent>
</Card>
