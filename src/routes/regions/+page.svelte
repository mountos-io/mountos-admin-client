<script lang="ts">
  import { goto } from "$app/navigation";
  import { useRegions } from "$lib/core/stores/regions.svelte";
  import { useAccounts } from "$lib/core/stores/accounts.svelte";
  import { useAuth } from "$lib/core/stores/auth.svelte";
  import { usePreferences } from "$lib/stores/preferences.svelte";
  import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
  } from "$lib/components/ui/table";
  import { Button } from "$lib/components/ui/button";
  import StatusBadge from "$lib/components/shared/StatusBadge.svelte";
  import Pagination from "$lib/components/shared/Pagination.svelte";
  import LoadingSpinner from "$lib/components/shared/LoadingSpinner.svelte";
  import EmptyState from "$lib/components/shared/EmptyState.svelte";
  import ConfirmDialog from "$lib/components/shared/ConfirmDialog.svelte";
  import { formatDate } from "$lib/core/utils/format";
  import { showErrorToast, showSuccessToast } from "$lib/core/utils/toast";
  import { useConfirmDialog } from "$lib/stores/confirm-dialog.svelte";
  import { Input } from "$lib/components/ui/input";
  import { HUB_REGION_NAME } from "$lib/core/constants";
  import Plus from "@lucide/svelte/icons/plus";
  import Power from "@lucide/svelte/icons/power";
  import Copy from "@lucide/svelte/icons/copy";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import HardDriveIcon from "@lucide/svelte/icons/hard-drive";

  const store = useRegions();
  const accountStore = useAccounts();
  const auth = useAuth();
  const accountId = $derived(accountStore.selectedAccountId);
  const prefs = usePreferences();
  const dialog = useConfirmDialog();

  let nameFilter = $state('');
  const filteredRegions = $derived(
    nameFilter
      ? store.regions.filter(r => r.name.toLowerCase().includes(nameFilter.toLowerCase()))
      : store.regions
  );

  $effect(() => {
    if (!auth.loading && !auth.can("regions", "read")) {
      showErrorToast("Access denied");
      goto("/", { replaceState: true });
      return;
    }
    store.fetchRegions(1, prefs.pageSize);
  });

  async function copyExportId(exportId: string) {
    try {
      await navigator.clipboard.writeText(exportId);
      showSuccessToast("Copied to clipboard");
    } catch {
      showErrorToast("Failed to copy");
    }
  }

  function deactivate(region: { id: number; name: string; isActive: boolean }) {
    if (!region.isActive || !auth.guard("regions", "update")) return;
    dialog.confirm(
      'Deactivate Region',
      `Deactivate "${region.name}"? Make sure all nodes are stopped and all storages and volumes in this region are deactivated first. This action cannot be reverted.`,
      () => store.deactivateRegion(region.id),
      'destructive',
    );
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold tracking-tight">Regions</h1>
    {#if accountId && auth.can("regions", "create")}
      <Button href="/regions/create" variant="primary" size="sm" class="gap-1.5 cyberpunk-skewed-sm">
        <Plus class="h-4 w-4" />
        Create Region
      </Button>
    {/if}
  </div>
  <div class="corner-brackets relative border border-border/30 rounded-sm p-4 w-fit max-w-full">
    <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
    <div class="relative">
      <Input bind:value={nameFilter} placeholder="Filter by name..." aria-label="Filter by name" class="max-w-sm" />
    </div>
  </div>

  {#if store.loading}
    <LoadingSpinner />
  {:else if filteredRegions.length === 0}
    <EmptyState title="No regions" description={nameFilter ? 'No regions match the current filter.' : undefined} action={!nameFilter && auth.can('regions', 'create') ? { label: 'Create Region', href: '/regions/create' } : undefined} />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="th-cyber">Name</TableHead>
          <TableHead class="th-cyber">Base DNS</TableHead>
          <TableHead class="th-cyber">
            <span class="inline-flex items-center gap-1">
              Export ID
              <span
                title="Set as env on service instances to group them under one regional umbrella"
              >
                <Lightbulb class="size-3.5 text-warning" aria-hidden="true" />
              </span>
            </span>
          </TableHead>
          <TableHead class="th-cyber">Status</TableHead>
          <TableHead class="th-cyber">Created</TableHead>
          <TableHead class="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each filteredRegions as region}
          <TableRow
            class="cursor-pointer hover:bg-muted/50"
            onclick={() => goto(`/nodes/${region.id}`)}
            onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), goto(`/nodes/${region.id}`))}
            role="link"
            tabindex={0}
          >
            <TableCell class="font-medium max-w-[160px] truncate">{region.name}</TableCell>
            <TableCell class="font-mono text-sm max-w-[200px] truncate">{region.dns}</TableCell>
            <TableCell>
              <span class="inline-flex items-center gap-1 font-mono text-sm">
                {region.exportId}
                <button
                  type="button"
                  title="Copy Export ID" aria-label="Copy Export ID"
                  class="text-muted-foreground hover:text-foreground transition-colors"
                  onclick={(e: MouseEvent) => { e.stopPropagation(); copyExportId(region.exportId) }}
                >
                  <Copy class="size-3.5" aria-hidden="true" />
                </button>
              </span>
            </TableCell>
            <TableCell><StatusBadge active={region.isActive} /></TableCell>
            <TableCell class="text-muted-foreground"
              >{formatDate(region.createdAt)}</TableCell
            >
            <TableCell>
              <div class="flex justify-end gap-1">
              {#if region.name !== HUB_REGION_NAME && auth.can("storages", "create")}
                <Button variant="ghost" size="sm"
                  href="/storages/create?regionId={region.id}"
                  title="Create Storage" aria-label="Create Storage"
                  onclick={(e: MouseEvent) => e.stopPropagation()}>
                  <HardDriveIcon class="size-3.5" aria-hidden="true" />
                </Button>
              {/if}
              {#if region.name !== HUB_REGION_NAME && region.isActive && auth.can("regions", "update")}
                <Button
                  variant="ghost"
                  size="sm"
                  title="Deactivate {region.name}"
                  aria-label="Deactivate {region.name}"
                  onclick={(e: MouseEvent) => { e.stopPropagation(); deactivate(region) }}
                >
                  <Power
                    aria-hidden="true"
                    class="size-3.5 text-destructive"
                  />
                </Button>
              {/if}
              </div>
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination
      currentPage={store.currentPage}
      totalPages={store.totalPages}
      onPageChange={(p) => store.fetchRegions(p, prefs.pageSize)}
    />
  {/if}
</div>
<ConfirmDialog
  bind:open={dialog.open}
  title={dialog.title}
  description={dialog.desc}
  variant={dialog.variant}
  onConfirm={dialog.action}
/>
