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
  import EmptyState from "$lib/components/shared/EmptyState.svelte";
  import TableSkeleton from "$lib/components/shared/TableSkeleton.svelte";
  import ConfirmDialog from "$lib/components/shared/ConfirmDialog.svelte";
  import { formatDate, formatBytes } from "$lib/core/utils/format";
  import { showErrorToast, showSuccessToast } from "$lib/core/utils/toast";
  import { useConfirmDialog } from "$lib/stores/confirm-dialog.svelte";
  import { Input } from "$lib/components/ui/input";
  import { HUB_REGION_NAME } from "$lib/core/constants";
  import Plus from "@lucide/svelte/icons/plus";
  import Power from "@lucide/svelte/icons/power";
  import Copy from "@lucide/svelte/icons/copy";
  import PageHeader from '$lib/components/shared/PageHeader.svelte';
  import FilterPanel from '$lib/components/shared/FilterPanel.svelte';
  import InfoTip from '$lib/components/shared/InfoTip.svelte';
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
      `Permanently deactivate "${region.name}"? All nodes must be stopped and all storages and volumes deactivated first.`,
      () => store.deactivateRegion(region.id),
      'destructive',
    );
  }
</script>

<svelte:head><title>Regions · mountOS Admin</title></svelte:head>

<div class="space-y-4">
  <PageHeader title="Regions" action={accountId && auth.can("regions", "create") ? { label: 'Create Region', href: '/regions/create', icon: Plus } : undefined} />
  <FilterPanel class="max-w-full">
    <Input bind:value={nameFilter} placeholder="Filter by name..." aria-label="Filter by name" class="max-w-sm" />
  </FilterPanel>

  {#snippet headerRow()}
    <TableRow>
      <TableHead class="th-cyber">Name</TableHead>
      <TableHead class="th-cyber">Base DNS</TableHead>
      <TableHead class="th-cyber hidden lg:table-cell">
        <span class="inline-flex items-center gap-1">
          Export ID
          <InfoTip text="Set as env on service instances to group them under one regional umbrella" />
        </span>
      </TableHead>
      <TableHead class="th-cyber hidden md:table-cell">
        <span class="inline-flex items-center gap-1">
          Live
          <InfoTip text="Sum of all live files across volumes in this region" />
        </span>
      </TableHead>
      <TableHead class="th-cyber hidden md:table-cell">
        <span class="inline-flex items-center gap-1">
          Total
          <InfoTip text="Total storage space used across volumes in this region" />
        </span>
      </TableHead>
      <TableHead class="th-cyber">Status</TableHead>
      <TableHead class="th-cyber">Created</TableHead>
      <TableHead class="w-24"></TableHead>
    </TableRow>
  {/snippet}

  {#if store.loading}
    <TableSkeleton
      header={headerRow}
      caption="Loading regions"
      cells={[
        { width: 'w-32' },
        { width: 'w-40' },
        { width: 'w-24', class: 'hidden lg:table-cell' },
        { width: 'w-16', class: 'hidden md:table-cell' },
        { width: 'w-16', class: 'hidden md:table-cell' },
        { width: 'w-16', height: 'h-5' },
        { width: 'w-20' },
        { width: 'w-12' },
      ]}
    />
  {:else if filteredRegions.length === 0}
    <EmptyState title="No regions" description={nameFilter ? 'No regions match the current filter.' : undefined} action={!nameFilter && auth.can('regions', 'create') ? { label: 'Create Region', href: '/regions/create' } : undefined} />
  {:else}
    <Table>
      <caption class="sr-only">Regions</caption>
      <TableHeader>
        {@render headerRow()}
      </TableHeader>
      <TableBody>
        {#each filteredRegions as region}
          <TableRow
            class="cursor-pointer hover:bg-muted/50"
            role="button"
            onclick={() => goto(`/regions/${region.id}`)}
            onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), goto(`/regions/${region.id}`))}
            tabindex={0}
            aria-label="Region {region.name}"
          >
            <TableCell class="font-medium max-w-[160px] truncate" title={region.name}>{region.name}</TableCell>
            <TableCell class="font-mono text-sm max-w-[200px] truncate" title={region.dns}>{region.dns}</TableCell>
            <TableCell class="hidden lg:table-cell">
              <span class="inline-flex items-center gap-1 font-mono text-sm">
                {region.exportId}
                <button
                  type="button"
                  title="Copy Export ID" aria-label="Copy Export ID"
                  class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 -m-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  onclick={(e: MouseEvent) => { e.stopPropagation(); copyExportId(region.exportId) }}
                >
                  <Copy class="size-3.5" aria-hidden="true" />
                </button>
              </span>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground hidden md:table-cell font-mono">{formatBytes(region.liveVolume)}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden md:table-cell font-mono">{formatBytes(region.totalVolume)}</TableCell>
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
