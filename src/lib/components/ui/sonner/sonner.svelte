<script lang="ts">
  import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";
  import { mode } from "mode-watcher";

  let { ...restProps }: SonnerProps = $props();
</script>

<Sonner
  theme={mode.current}
  class="toaster group"
  closeButton={true}
  position="top-right"
  expand={true}
  visibleToasts={5}
  gap={16}
  style="--normal-bg: var(--card); --normal-text: var(--card-foreground); --normal-border: var(--border);"
  {...restProps}
/>
