<script lang="ts">
  import { tick } from "svelte";
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
  import { handleApiError, showErrorToast } from "$lib/core/utils/toast";
  import { useConfirmDialog } from "$lib/stores/confirm-dialog.svelte";
  import { Input } from "$lib/components/ui/input";
  import { HUB_REGION_NAME } from "$lib/core/constants";
  import Plus from "@lucide/svelte/icons/plus";
  import Power from "@lucide/svelte/icons/power";
  import PageHeader from '$lib/components/shared/PageHeader.svelte';
  import HowItWorks from '$lib/components/shared/HowItWorks.svelte';
  import FilterPanel from '$lib/components/shared/FilterPanel.svelte';
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte';
  import InfoTip from '$lib/components/shared/InfoTip.svelte';
  import HardDriveIcon from "@lucide/svelte/icons/hard-drive";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import ShieldAlert from "@lucide/svelte/icons/shield-alert";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Select } from "$lib/components/ui/select";
  import Label from "$lib/components/ui/label/label.svelte";
  import { api } from "$lib/core/stores/client.svelte";
  import { ROLE } from "$lib/core/auth/adapter";
  import { copyText } from "$lib/core/utils/clipboard";

  const store = useRegions();
  const accountStore = useAccounts();
  const auth = useAuth();
  const accountId = $derived(accountStore.selectedAccountId);
  const prefs = usePreferences();
  const dialog = useConfirmDialog();
  const isSuperAdmin = $derived(auth.user?.role === ROLE.superadmin);

  const TOKEN_EXPIRY_OPTIONS = [
    { label: 'Never expires', value: '0' },
    { label: '1 day', value: '86400' },
    { label: '7 days', value: '604800' },
    { label: '30 days', value: '2592000' },
  ];
  let tokenDialogOpen = $state(false);
  let tokenExpiry = $state('0');
  let tokenInFlight = $state(false);
  let tokenResult = $state<{ token: string } | null>(null);
  let copiedToken = $state(false);
  let copyTokenBtn = $state<HTMLButtonElement | null>(null);

  function openTokenDialog() {
    tokenResult = null;
    tokenExpiry = '0';
    tokenDialogOpen = true;
  }

  function closeTokenDialog() {
    tokenDialogOpen = false;
    tokenResult = null;
    copiedToken = false;
  }

  async function generateToken() {
    tokenInFlight = true;
    try {
      tokenResult = await api.metrics.generateToken({ expirySeconds: Number(tokenExpiry) });
      await tick();
      copyTokenBtn?.focus();
    } catch (e: unknown) {
      handleApiError(e, 'Failed to generate metrics token');
    } finally {
      tokenInFlight = false;
    }
  }

  async function copyToken() {
    if (!tokenResult) return;
    if (await copyText(tokenResult.token)) {
      copiedToken = true;
      setTimeout(() => { copiedToken = false; }, 1500);
    } else {
      showErrorToast('Copy failed, select and copy manually');
    }
  }

  let nameFilter = $state('');
  let statusFilter = $state<'active' | 'inactive' | 'all'>('active');
  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'all', label: 'All' },
  ];

  const filteredRegions = $derived(
    nameFilter
      ? store.regions.filter(r => r.name.toLowerCase().includes(nameFilter.toLowerCase()))
      : store.regions
  );
  const hasFilter = $derived(nameFilter !== '' || statusFilter !== 'active');

  $effect(() => {
    if (!auth.loading && !auth.can("regions", "read")) {
      showErrorToast("Access denied");
      goto("/", { replaceState: true });
      return;
    }
    void statusFilter;
    if (accountId == null) return;
    store.fetchRegions(accountId, {
      page: 1,
      limit: prefs.pageSize,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
    });
  });

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
  <PageHeader title="Regions" action={accountId && auth.can("regions", "create") ? { label: 'Create Region', href: '/regions/create', icon: Plus } : undefined}>
    <HowItWorks topic="region" />
    {#if isSuperAdmin}
      <Button variant="outline" size="sm" class="gap-1.5" onclick={openTokenDialog}>
        <KeyRound class="h-3.5 w-3.5" aria-hidden="true" />
        Generate Metrics Token
      </Button>
    {/if}
  </PageHeader>
  <FilterPanel class="max-w-full">
    <Input bind:value={nameFilter} placeholder="Filter by name..." aria-label="Filter by name" class="max-w-sm" />
    <FilterSelect
      options={statusOptions}
      value={statusFilter}
      placeholder="Active"
      label="Filter by status"
      onchange={(v) => (statusFilter = v as 'active' | 'inactive' | 'all')}
    />
  </FilterPanel>

  {#snippet headerRow()}
    <TableRow>
      <TableHead class="th-cyber">Name</TableHead>
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
        { width: 'w-16', class: 'hidden md:table-cell' },
        { width: 'w-16', class: 'hidden md:table-cell' },
        { width: 'w-16', height: 'h-5' },
        { width: 'w-20' },
        { width: 'w-12' },
      ]}
    />
  {:else if filteredRegions.length === 0}
    <EmptyState title="No regions" description={hasFilter ? 'No regions match the current filters.' : undefined} action={!hasFilter && auth.can('regions', 'create') ? { label: 'Create Region', href: '/regions/create' } : undefined} />
  {:else}
    <Table>
      <caption class="sr-only">Regions</caption>
      <TableHeader>
        {@render headerRow()}
      </TableHeader>
      <TableBody>
        {#each filteredRegions as region (region.id)}
          <TableRow
            class={`relative cursor-pointer hover:bg-muted/50 ${region.isActive ? '' : 'bg-muted/40'}`}
          >
            <TableCell class="font-medium max-w-[160px] truncate" title={region.name}>
              <a href="/regions/{region.id}" class="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring" aria-label="Region {region.name}{region.isActive ? '' : ', deactivated'}">{region.name}</a>
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
                <Button variant="ghost" size="sm" class="relative z-10"
                  href="/storages/create?regionId={region.id}"
                  title="Create Storage" aria-label="Create Storage">
                  <HardDriveIcon class="size-3.5" aria-hidden="true" />
                </Button>
              {/if}
              {#if region.name !== HUB_REGION_NAME && region.isActive && auth.can("regions", "update")}
                <Button
                  variant="ghost"
                  size="sm"
                  class="relative z-10"
                  title="Deactivate {region.name}"
                  aria-label="Deactivate {region.name}"
                  onclick={() => deactivate(region)}
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
      onPageChange={(p) => { if (accountId != null) store.fetchRegions(accountId, {
        page: p,
        limit: prefs.pageSize,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      }); }}
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

<Dialog.Root bind:open={tokenDialogOpen} onOpenChange={(v) => { if (!v) closeTokenDialog(); }}>
  <Dialog.Content class="sm:max-w-2xl">
    {#if tokenResult}
      <Dialog.Header>
        <div class="flex items-start gap-3">
          <ShieldAlert class="size-5 shrink-0 text-warning mt-0.5" aria-hidden="true" />
          <div class="flex flex-col gap-1">
            <Dialog.Title>Metrics Token Generated</Dialog.Title>
            <Dialog.Description>
              Copy and save this token now. It will not be shown again.
            </Dialog.Description>
          </div>
        </div>
      </Dialog.Header>
      <div class="flex items-center gap-2">
        <code class="flex-1 font-mono text-sm break-all bg-muted/50 rounded-sm px-2.5 py-1.5 border select-all">{tokenResult.token}</code>
        <button type="button" bind:this={copyTokenBtn}
          class="shrink-0 size-11 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onclick={copyToken} aria-label="Copy metrics token">
          {#if copiedToken}<Check class="size-4 text-success" aria-hidden="true" />{:else}<Copy class="size-4" aria-hidden="true" />{/if}
        </button>
      </div>
      <span class="sr-only" role="status" aria-live="polite">{copiedToken ? 'Metrics token copied to clipboard' : ''}</span>
      <Dialog.Footer>
        <Button variant="primary" onclick={closeTokenDialog}>Done</Button>
      </Dialog.Footer>
    {:else}
      <Dialog.Header>
        <Dialog.Title>Generate Metrics Token</Dialog.Title>
        <Dialog.Description>
          Mints a bearer token that only authorizes scraping each service's metrics endpoint and the metrics service-discovery endpoint.
        </Dialog.Description>
      </Dialog.Header>
      <div class="space-y-2">
        <Label for="metrics-token-expiry" id="metrics-token-expiry-label">Expiry</Label>
        <Select
          id="metrics-token-expiry"
          options={TOKEN_EXPIRY_OPTIONS}
          bind:value={tokenExpiry}
          ariaLabelledby="metrics-token-expiry-label"
        />
      </div>
      <Dialog.Footer>
        <Button variant="outline" onclick={closeTokenDialog}>Cancel</Button>
        <Button variant="primary" disabled={tokenInFlight} aria-busy={tokenInFlight} onclick={generateToken}>
          {#if tokenInFlight}<Loader2 class="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />{/if}
          Generate
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
