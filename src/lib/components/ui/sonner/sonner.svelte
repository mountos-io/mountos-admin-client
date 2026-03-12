<script lang="ts">
  import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";
  import { mode } from "mode-watcher";

  let { ...restProps }: SonnerProps = $props();
</script>

<Sonner
  theme={mode.current}
  class="toaster group"
  richColors={true}
  closeButton={true}
  position="top-right"
  expand={true}
  visibleToasts={5}
  gap={16}
  style="--normal-bg: var(--popover); --normal-text: var(--popover-foreground); --normal-border: var(--border);"
  {...restProps}
/>
