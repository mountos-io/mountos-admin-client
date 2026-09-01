<script lang="ts">
  import DiagramViewer from '$lib/components/shared/DiagramViewer.svelte'
  import CopysetRegistrationDiagram from '$lib/components/diagrams/CopysetRegistrationDiagram.svelte'
</script>

<div class="space-y-4">
  <p class="text-sm text-muted-foreground">Registering a copyset creates two servers as a pair, together, in one step.</p>

  <DiagramViewer ariaLabel="Copyset registration diagram">
    <CopysetRegistrationDiagram />
  </DiagramViewer>

  <ul class="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
    <li><span class="font-medium text-foreground">One name for the pair.</span> Give the copyset a name, or leave it blank to auto-generate one. Both servers take related names, so a pair is always easy to recognize.</li>
    <li><span class="font-medium text-foreground">One at a time, or many at once.</span> "Add copyset" registers a single pair. "Add multiple" registers a batch in one step, every name auto-generated - useful when bringing up several pairs together.</li>
    <li><span class="font-medium text-foreground">A pairing is permanent.</span> The two servers you register together stay paired for the copyset's life.</li>
    <li><span class="font-medium text-foreground">Spread them out.</span> Placing a copyset's two servers in different placement or availability zones is good practice for fault isolation.</li>
  </ul>
</div>
