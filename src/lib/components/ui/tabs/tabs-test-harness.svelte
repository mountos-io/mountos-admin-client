<script lang="ts">
  // Test-only harness: a minimal, concrete composition of the Tabs primitive so
  // tabs.test.ts can render and interact with it via testing-library.
  import * as Tabs from './index'

  let value = $state('a')
</script>

<Tabs.Root bind:value>
  <Tabs.List>
    <Tabs.Trigger value="a">Tab A</Tabs.Trigger>
    <Tabs.Trigger value="b">Tab B</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="a">Panel A content</Tabs.Content>
  <Tabs.Content value="b">Panel B content</Tabs.Content>
</Tabs.Root>
