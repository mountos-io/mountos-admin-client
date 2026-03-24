<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Badge } from '$lib/components/ui/badge'
  import Button from '$lib/components/ui/button/button.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import StepUpModal from '$lib/components/shared/StepUpModal.svelte'
  import { Input } from '$lib/components/ui/input'
  import { useWebAuthn } from '$lib/core/stores/webauthn.svelte'
  import { useStepUp, createStepUpHandler } from '$lib/core/stores/stepup.svelte'
  import {
    showSuccessToast, showErrorToast, showWarningToast, showInfoToast,
    showLoadingToastWithUpdate, dismissAllToasts,
  } from '$lib/core/utils/toast'

  const webauthn = useWebAuthn()
  const stepUp = useStepUp()
  const demandStepUp = createStepUpHandler()

  let renameId = $state('')
  let renameLabel = $state('')
  let deleteId = $state('')
  let webauthnLog = $state<string[]>([])

  function log(msg: string) {
    webauthnLog = [...webauthnLog, `[${new Date().toLocaleTimeString()}] ${msg}`]
  }

  async function handleFetchCredentials() {
    try {
      await webauthn.fetchCredentials()
      log(`Fetched ${webauthn.credentialCount} credential(s)`)
    } catch (e: unknown) {
      log(`Fetch error: ${e instanceof Error ? e.message : e}`)
    }
  }

  async function handleRegister() {
    try {
      log('Registering...')
      await webauthn.registerCredential()
      log(`Registered — total: ${webauthn.credentialCount}`)
    } catch (e: unknown) {
      log(`Register error: ${e instanceof Error ? e.message : e}`)
    }
  }

  async function handleAuthenticate() {
    try {
      log('Authenticating...')
      const token = await webauthn.authenticate()
      log(`Authenticated — stepUpToken: ${token.slice(0, 20)}...`)
    } catch (e: unknown) {
      log(`Auth error: ${e instanceof Error ? e.message : e}`)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      log(`Deleting credential ${deleteId}...`)
      await webauthn.deleteCredential(deleteId)
      log(`Deleted — remaining: ${webauthn.credentialCount}`)
      deleteId = ''
    } catch (e: unknown) {
      log(`Delete error: ${e instanceof Error ? e.message : e}`)
    }
  }

  async function handleRename() {
    if (!renameId || !renameLabel) return
    try {
      await webauthn.renameCredential(renameId, renameLabel)
      log(`Renamed ${renameId} → "${renameLabel}"`)
      renameId = ''
      renameLabel = ''
    } catch (e: unknown) {
      log(`Rename error: ${e instanceof Error ? e.message : e}`)
    }
  }

  async function handleStepUpFlow() {
    try {
      log('Requesting step-up verification (modal)...')
      const token = await demandStepUp()
      log(`Step-up complete — token: ${token.slice(0, 20)}...`)
    } catch (e: unknown) {
      log(`Step-up cancelled/error: ${e instanceof Error ? e.message : e}`)
    }
  }

  const nodes = [
    { id: 'sn-0x7a3f', name: 'appserv-us-east-1a', type: 'appserv', addr: '10.0.12.41:9090', status: 'online', cpu: 23, mem: 61, uptime: '14d 7h' },
    { id: 'sn-0x8b2e', name: 'fuseserv-us-east-1b', type: 'fuseserv', addr: '10.0.12.42:9091', status: 'online', cpu: 67, mem: 84, uptime: '14d 7h' },
    { id: 'sn-0x1c9d', name: 'storeserv-eu-west-1a', type: 'storeserv', addr: '10.0.14.11:9092', status: 'degraded', cpu: 91, mem: 73, uptime: '3d 12h' },
    { id: 'sn-0x4e5a', name: 'appserv-ap-south-1a', type: 'appserv', addr: '10.0.16.22:9090', status: 'offline', cpu: 0, mem: 0, uptime: '—' },
    { id: 'sn-0x6f1b', name: 'fuseserv-eu-west-1b', type: 'fuseserv', addr: '10.0.14.12:9091', status: 'online', cpu: 45, mem: 52, uptime: '7d 2h' },
  ]

  function statusVariant(s: string) {
    return s === 'online' ? 'success' : s === 'degraded' ? 'warning' : 'destructive'
  }

  let currentPage = $state(3)

  let darkMode = $state(document.documentElement.classList.contains('dark'))

  function toggleTheme() {
    darkMode = !darkMode
    document.documentElement.classList.toggle('dark', darkMode)
  }
</script>

<div class="mx-auto max-w-5xl space-y-12 p-8">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Cyberpunk Design System</h1>
      <p class="mt-1 text-sm text-muted-foreground">Corner styles, brackets, and decorative elements</p>
    </div>
    <Button variant="outline" onclick={toggleTheme}>
      {darkMode ? 'Light' : 'Dark'}
    </Button>
  </div>

  <!-- Toast Notifications -->
  <section class="space-y-4">
    <div>
      <h2 class="text-xl font-semibold tracking-tight">Toast Notifications</h2>
      <p class="mt-1 text-sm text-muted-foreground">Type-specific left-edge accent, tinted backgrounds, themed icons</p>
    </div>
    <div class="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <Button variant="outline" onclick={() => showSuccessToast('Volume mounted', { description: 'vol-0x3a9f attached to node sn-0x7a3f' })}>
        Success
      </Button>
      <Button variant="outline" onclick={() => showErrorToast('Mount failed', { description: 'FUSE handshake timeout after 30s' })}>
        Error
      </Button>
      <Button variant="outline" onclick={() => showWarningToast('High memory usage', { description: 'Node sn-0x8b2e at 84% — consider rebalancing' })}>
        Warning
      </Button>
      <Button variant="outline" onclick={() => showInfoToast('Region sync complete', { description: 'us-east-1: 3 nodes, 12 volumes' })}>
        Info
      </Button>
      <Button variant="outline" onclick={() => {
        const t = showLoadingToastWithUpdate('Provisioning storage...')
        setTimeout(() => t.success('Storage provisioned', { description: 'store-0xf2a1 ready' }), 2500)
      }}>
        Loading
      </Button>
      <Button variant="outline" onclick={() => dismissAllToasts()}>
        Dismiss All
      </Button>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <Button variant="outline" onclick={() => showSuccessToast('Quick toast — no description')}>
        Title Only
      </Button>
      <Button variant="outline" onclick={() => showErrorToast('Connection refused', {
        description: 'storeserv-eu-west-1a:9092 unreachable',
        action: { label: 'Retry', onClick: () => showInfoToast('Retrying...') },
      })}>
        With Action
      </Button>
    </div>
  </section>

  <!-- Corner Brackets -->
  <section class="space-y-4">
    <h2 class="text-xl font-semibold tracking-tight">Corner Brackets</h2>
    <div class="grid gap-6 md:grid-cols-3">
      <Card cornerBrackets>
        <CardHeader><CardTitle>Dynamic Brackets</CardTitle></CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">cornerBrackets — L-shaped lines at all 4 corners, scale with card width (clamp 24px–60px)</p>
        </CardContent>
      </Card>
      <Card cornerBrackets fixedBrackets>
        <CardHeader><CardTitle>Fixed Brackets</CardTitle></CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">cornerBrackets + fixedBrackets — Fixed 32px bracket lines at all 4 corners</p>
        </CardContent>
      </Card>
      <div class="corner-brackets relative rounded-sm border bg-card p-6 text-card-foreground">
        <p class="text-sm font-medium">Standard Brackets (CSS)</p>
        <p class="mt-2 text-sm text-muted-foreground">.corner-brackets — smaller 20px fixed brackets, direct CSS class</p>
      </div>
    </div>
  </section>

  <!-- Corner Plus -->
  <section class="space-y-4">
    <h2 class="text-xl font-semibold tracking-tight">Corner Plus</h2>
    <div class="grid gap-6 md:grid-cols-3">
      <Card cornerPlus>
        <CardHeader><CardTitle>Plus Top-Right</CardTitle></CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">cornerPlus — + mark at top-right corner</p>
        </CardContent>
      </Card>
      <div class="corner-plus-bl relative rounded-sm border bg-card p-6 text-card-foreground">
        <p class="text-sm font-medium">Plus Bottom-Left (CSS)</p>
        <p class="mt-2 text-sm text-muted-foreground">.corner-plus-bl — + mark at bottom-left corner</p>
      </div>
      <Card cornerBrackets cornerPlus>
        <CardHeader><CardTitle>Brackets + Plus</CardTitle></CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">cornerBrackets + cornerPlus — combined bracket lines and + mark</p>
        </CardContent>
      </Card>
    </div>
  </section>

  <!-- Cyberpunk Skewed -->
  <section class="space-y-4">
    <h2 class="text-xl font-semibold tracking-tight">Cyberpunk Skewed Corners</h2>
    <div class="grid gap-6 md:grid-cols-2">
      <div class="cyberpunk-skewed bg-card text-card-foreground">
        <div class="cyberpunk-skewed-inner">
          <p class="text-sm font-medium">Standard Skew</p>
          <p class="mt-2 text-sm text-muted-foreground">.cyberpunk-skewed — 20px angled clip-path cuts at top-left and bottom-right</p>
        </div>
      </div>
      <div class="cyberpunk-skewed-lg bg-card text-card-foreground">
        <div class="cyberpunk-skewed-inner">
          <p class="text-sm font-medium">Large Skew</p>
          <p class="mt-2 text-sm text-muted-foreground">.cyberpunk-skewed-lg — 32px pronounced angled cuts</p>
        </div>
      </div>
    </div>
    <div class="flex gap-4">
      <button class="cyberpunk-skewed-sm bg-primary px-6 py-2 text-sm font-medium text-primary-foreground">
        Skewed Button
      </button>
      <button class="cyberpunk-skewed-sm border border-border bg-card px-6 py-2 text-sm font-medium text-card-foreground">
        Skewed Outline
      </button>
    </div>
  </section>

  <!-- Technical Patterns -->
  <section class="space-y-4">
    <h2 class="text-xl font-semibold tracking-tight">Technical Patterns</h2>
    <div class="grid gap-6 md:grid-cols-2">
      <div class="tech-grid rounded-sm border bg-card p-6">
        <p class="text-sm font-medium text-card-foreground">Tech Grid</p>
        <p class="mt-2 text-sm text-muted-foreground">.tech-grid — subtle 20px grid pattern background</p>
      </div>
      <div class="rounded-sm border bg-card p-6">
        <p class="text-sm font-medium text-card-foreground">Dashed Connector</p>
        <div class="my-3">
          <hr class="dashed-connector" />
        </div>
        <p class="text-sm text-muted-foreground">.dashed-connector — dashed separator line</p>
      </div>
    </div>
  </section>

  <!-- Minimal Border -->
  <section class="space-y-4">
    <h2 class="text-xl font-semibold tracking-tight">Borders</h2>
    <div class="grid gap-6 md:grid-cols-2">
      <div class="border-minimal rounded-sm p-6">
        <p class="text-sm font-medium">.border-minimal</p>
        <p class="mt-2 text-sm text-muted-foreground">Thin minimal border with muted color</p>
      </div>
      <div class="rounded-sm border p-6">
        <p class="text-sm font-medium">Default border</p>
        <p class="mt-2 text-sm text-muted-foreground">Standard Tailwind border for comparison</p>
      </div>
    </div>
  </section>

  <!-- Combined Examples -->
  <section class="space-y-4">
    <h2 class="text-xl font-semibold tracking-tight">Combined Examples</h2>
    <div class="grid gap-6 md:grid-cols-2">
      <Card cornerBrackets fixedBrackets cornerPlus>
        <CardHeader><CardTitle>Full Cyber Card</CardTitle></CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">Fixed brackets + plus sign — maximum decoration</p>
          <div class="mt-4 flex gap-2">
            <Button variant="primary" size="sm">Accept</Button>
            <Button variant="destructive" size="sm">Reject</Button>
          </div>
        </CardContent>
      </Card>
      <div class="corner-brackets-lg corner-plus tech-grid relative rounded-sm border bg-card p-6 text-card-foreground">
        <p class="text-sm font-medium">Grid + Brackets + Plus</p>
        <p class="mt-2 text-sm text-muted-foreground">Layered: tech-grid background with bracket corners and plus mark</p>
      </div>
    </div>
  </section>

  <!-- Hover States -->
  <section class="space-y-4">
    <h2 class="text-xl font-semibold tracking-tight">Hover States</h2>
    <p class="text-sm text-muted-foreground">Hover over cards to see accent color transitions on brackets and plus marks.</p>
    <div class="grid gap-6 md:grid-cols-4">
      <Card cornerBrackets>
        <CardContent class="py-4"><p class="text-center text-sm">Brackets</p></CardContent>
      </Card>
      <Card cornerPlus>
        <CardContent class="py-4"><p class="text-center text-sm">Plus</p></CardContent>
      </Card>
      <Card cornerBrackets cornerPlus>
        <CardContent class="py-4"><p class="text-center text-sm">Both</p></CardContent>
      </Card>
      <Card cornerBrackets fixedBrackets>
        <CardContent class="py-4"><p class="text-center text-sm">Fixed</p></CardContent>
      </Card>
    </div>
  </section>

  <!-- Tables -->
  <section class="space-y-8">
    <div>
      <h2 class="text-xl font-semibold tracking-tight">Tables</h2>
      <p class="mt-1 text-sm text-muted-foreground">Cyberpunk table variants for data-dense admin views</p>
    </div>

    <!-- Variant 1: Base table -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-widest">Base</h3>
      <div class="rounded-sm border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">CPU</TableHead>
              <TableHead class="text-right">Mem</TableHead>
              <TableHead class="text-right">Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each nodes as n}
              <TableRow>
                <TableCell class="font-mono text-xs">{n.id}</TableCell>
                <TableCell>{n.type}</TableCell>
                <TableCell class="font-mono text-xs">{n.addr}</TableCell>
                <TableCell><Badge variant={statusVariant(n.status)}>{n.status}</Badge></TableCell>
                <TableCell class="text-right font-mono text-xs">{n.cpu}%</TableCell>
                <TableCell class="text-right font-mono text-xs">{n.mem}%</TableCell>
                <TableCell class="text-right text-muted-foreground">{n.uptime}</TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Variant 2: Corner brackets wrapper -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-widest">Corner Brackets</h3>
      <div class="corner-brackets-lg corner-plus relative rounded-sm border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">CPU</TableHead>
              <TableHead class="text-right">Mem</TableHead>
              <TableHead class="text-right">Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each nodes as n}
              <TableRow>
                <TableCell class="font-mono text-xs">{n.id}</TableCell>
                <TableCell>{n.type}</TableCell>
                <TableCell class="font-mono text-xs">{n.addr}</TableCell>
                <TableCell><Badge variant={statusVariant(n.status)}>{n.status}</Badge></TableCell>
                <TableCell class="text-right font-mono text-xs">{n.cpu}%</TableCell>
                <TableCell class="text-right font-mono text-xs">{n.mem}%</TableCell>
                <TableCell class="text-right text-muted-foreground">{n.uptime}</TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Variant 3: Tech grid + scanline rows -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-widest">Tech Grid + Scanlines</h3>
      <div class="corner-brackets-lg relative rounded-sm border bg-card tech-grid">
        <Table>
          <TableHeader>
            <TableRow class="border-b-2 border-primary/30">
              <TableHead>Node</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">CPU</TableHead>
              <TableHead class="text-right">Mem</TableHead>
              <TableHead class="text-right">Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each nodes as n, i}
              <TableRow class={i % 2 === 0 ? 'bg-background/40' : ''}>
                <TableCell class="font-mono text-xs">{n.id}</TableCell>
                <TableCell>{n.type}</TableCell>
                <TableCell class="font-mono text-xs">{n.addr}</TableCell>
                <TableCell><Badge variant={statusVariant(n.status)}>{n.status}</Badge></TableCell>
                <TableCell class="text-right font-mono text-xs">{n.cpu}%</TableCell>
                <TableCell class="text-right font-mono text-xs">{n.mem}%</TableCell>
                <TableCell class="text-right text-muted-foreground">{n.uptime}</TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Variant 4: Skewed header -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-widest">Skewed Header</h3>
      <div class="rounded-sm border bg-card overflow-hidden">
        <div class="cyberpunk-skewed-sm bg-primary/10 px-2">
          <table class="w-full text-sm tabular-nums">
            <thead>
              <tr>
                <th class="text-muted-foreground h-10 whitespace-nowrap px-2 text-left align-middle font-medium text-xs uppercase tracking-wider">Node</th>
                <th class="text-muted-foreground h-10 whitespace-nowrap px-2 text-left align-middle font-medium text-xs uppercase tracking-wider">Type</th>
                <th class="text-muted-foreground h-10 whitespace-nowrap px-2 text-left align-middle font-medium text-xs uppercase tracking-wider">Address</th>
                <th class="text-muted-foreground h-10 whitespace-nowrap px-2 text-left align-middle font-medium text-xs uppercase tracking-wider">Status</th>
                <th class="text-muted-foreground h-10 whitespace-nowrap px-2 text-right align-middle font-medium text-xs uppercase tracking-wider">CPU</th>
                <th class="text-muted-foreground h-10 whitespace-nowrap px-2 text-right align-middle font-medium text-xs uppercase tracking-wider">Mem</th>
                <th class="text-muted-foreground h-10 whitespace-nowrap px-2 text-right align-middle font-medium text-xs uppercase tracking-wider">Uptime</th>
              </tr>
            </thead>
          </table>
        </div>
        <Table>
          <TableBody>
            {#each nodes as n}
              <TableRow>
                <TableCell class="font-mono text-xs">{n.id}</TableCell>
                <TableCell>{n.type}</TableCell>
                <TableCell class="font-mono text-xs">{n.addr}</TableCell>
                <TableCell><Badge variant={statusVariant(n.status)}>{n.status}</Badge></TableCell>
                <TableCell class="text-right font-mono text-xs">{n.cpu}%</TableCell>
                <TableCell class="text-right font-mono text-xs">{n.mem}%</TableCell>
                <TableCell class="text-right text-muted-foreground">{n.uptime}</TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Variant 5: Accent left-border rows + inline metrics -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-widest">Accent Border + Inline Bars</h3>
      <div class="corner-brackets-lg-fixed corner-plus relative rounded-sm border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>CPU</TableHead>
              <TableHead>Memory</TableHead>
              <TableHead class="text-right">Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each nodes as n}
              <TableRow class="border-l-2 border-l-transparent hover:border-l-primary">
                <TableCell class="font-mono text-xs">{n.id}</TableCell>
                <TableCell class="font-medium">{n.name}</TableCell>
                <TableCell><Badge variant={statusVariant(n.status)}>{n.status}</Badge></TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all {n.cpu > 80 ? 'bg-destructive' : n.cpu > 50 ? 'bg-warning' : 'bg-success'}"
                        style="width: {n.cpu}%"
                      ></div>
                    </div>
                    <span class="font-mono text-xs text-muted-foreground w-8 text-right">{n.cpu}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all {n.mem > 80 ? 'bg-destructive' : n.mem > 50 ? 'bg-warning' : 'bg-success'}"
                        style="width: {n.mem}%"
                      ></div>
                    </div>
                    <span class="font-mono text-xs text-muted-foreground w-8 text-right">{n.mem}%</span>
                  </div>
                </TableCell>
                <TableCell class="text-right text-muted-foreground">{n.uptime}</TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Variant 6: Full cyberpunk — skewed container + grid + brackets -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-widest">Full Cyberpunk</h3>
      <div class="cyberpunk-skewed bg-card">
        <div class="cyberpunk-skewed-inner !p-0">
          <div class="corner-brackets relative tech-grid">
            <Table>
              <TableHeader>
                <TableRow class="border-b-2 border-primary/20">
                  <TableHead>Node</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Memory</TableHead>
                  <TableHead class="text-right">Uptime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each nodes as n, i}
                  <TableRow class="border-l-2 border-l-transparent hover:border-l-primary {i % 2 === 0 ? 'bg-background/30' : ''}">
                    <TableCell class="font-mono text-xs">{n.id}</TableCell>
                    <TableCell class="font-medium">{n.name}</TableCell>
                    <TableCell><Badge variant={statusVariant(n.status)}>{n.status}</Badge></TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <div class="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            class="h-full rounded-full {n.cpu > 80 ? 'bg-destructive' : n.cpu > 50 ? 'bg-warning' : 'bg-success'}"
                            style="width: {n.cpu}%"
                          ></div>
                        </div>
                        <span class="font-mono text-xs text-muted-foreground w-8 text-right">{n.cpu}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <div class="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            class="h-full rounded-full {n.mem > 80 ? 'bg-destructive' : n.mem > 50 ? 'bg-warning' : 'bg-success'}"
                            style="width: {n.mem}%"
                          ></div>
                        </div>
                        <span class="font-mono text-xs text-muted-foreground w-8 text-right">{n.mem}%</span>
                      </div>
                    </TableCell>
                    <TableCell class="text-right text-muted-foreground">{n.uptime}</TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-widest">With Pagination</h3>
      <div class="corner-brackets-lg-fixed corner-plus relative rounded-sm border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">CPU</TableHead>
              <TableHead class="text-right">Mem</TableHead>
              <TableHead class="text-right">Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each nodes as n}
              <TableRow class="border-l-2 border-l-transparent hover:border-l-primary">
                <TableCell class="font-mono text-xs">{n.id}</TableCell>
                <TableCell class="font-medium">{n.name}</TableCell>
                <TableCell><Badge variant={statusVariant(n.status)}>{n.status}</Badge></TableCell>
                <TableCell class="text-right font-mono text-xs">{n.cpu}%</TableCell>
                <TableCell class="text-right font-mono text-xs">{n.mem}%</TableCell>
                <TableCell class="text-right text-muted-foreground">{n.uptime}</TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
        <Pagination {currentPage} totalPages={12} onPageChange={(p) => currentPage = p} />
      </div>
    </div>
  </section>

  <!-- WebAuthn Testing -->
  <section class="space-y-4">
    <div>
      <h2 class="text-xl font-semibold tracking-tight">WebAuthn Testing</h2>
      <p class="mt-1 text-sm text-muted-foreground">Register, authenticate, and manage security keys</p>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <!-- Status -->
      <Card cornerBrackets>
        <CardHeader><CardTitle>Status</CardTitle></CardHeader>
        <CardContent class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Enrolled</span>
            <Badge variant={webauthn.enrolled ? 'success' : 'secondary'}>
              {webauthn.enrolled ? 'Yes' : 'No'}
            </Badge>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Credentials</span>
            <span class="font-mono">{webauthn.credentialCount}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Loading</span>
            <span class="font-mono">{webauthn.loading}</span>
          </div>
          <div class="pt-2">
            <Button variant="outline" size="sm" onclick={handleFetchCredentials}>
              Fetch Credentials
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Register -->
      <Card cornerBrackets>
        <CardHeader><CardTitle>Register Key</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <p class="text-sm text-muted-foreground">Triggers browser security key prompt, server auto-labels with rpName</p>
          <Button size="sm" onclick={handleRegister}>Register</Button>
        </CardContent>
      </Card>

      <!-- Authenticate -->
      <Card cornerBrackets>
        <CardHeader><CardTitle>Authenticate</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <p class="text-sm text-muted-foreground">Direct authentication — returns a step-up token</p>
          <Button variant="outline" size="sm" onclick={handleAuthenticate}>Authenticate</Button>
        </CardContent>
      </Card>

      <!-- Step-Up Modal Flow -->
      <Card cornerBrackets>
        <CardHeader><CardTitle>Step-Up Modal</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <p class="text-sm text-muted-foreground">Full modal flow — register if not enrolled, then authenticate</p>
          <Button variant="primary" size="sm" onclick={handleStepUpFlow}>Test Step-Up Flow</Button>
        </CardContent>
      </Card>

      <!-- Delete -->
      <Card cornerBrackets>
        <CardHeader><CardTitle>Delete Credential</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <div class="flex items-end gap-2">
            <div class="flex-1">
              <Input bind:value={deleteId} placeholder="Credential ID" class="h-9" />
            </div>
            <Button variant="destructive" size="sm" onclick={handleDelete}>Delete</Button>
          </div>
        </CardContent>
      </Card>

      <!-- Rename -->
      <Card cornerBrackets>
        <CardHeader><CardTitle>Rename Credential</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <div class="flex items-end gap-2">
            <div class="flex-1 space-y-2">
              <Input bind:value={renameId} placeholder="Credential ID" class="h-9" />
              <Input bind:value={renameLabel} placeholder="New label" class="h-9" />
            </div>
            <Button variant="outline" size="sm" onclick={handleRename}>Rename</Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Credential List -->
    {#if webauthn.credentials.length > 0}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-widest">Registered Credentials</h3>
        <div class="corner-brackets-lg relative rounded-sm border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Counter</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each webauthn.credentials as c}
                <TableRow>
                  <TableCell class="font-mono text-xs max-w-[200px] truncate">{c.id}</TableCell>
                  <TableCell>{c.label}</TableCell>
                  <TableCell class="font-mono text-xs">{c.counter}</TableCell>
                  <TableCell class="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</TableCell>
                  <TableCell class="text-xs text-muted-foreground">{new Date(c.lastUsedAt).toLocaleString()}</TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>
        </div>
      </div>
    {/if}

    <!-- Log -->
    {#if webauthnLog.length > 0}
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-widest">Log</h3>
          <Button variant="ghost" size="sm" onclick={() => webauthnLog = []}>Clear</Button>
        </div>
        <div class="rounded-sm border bg-card p-4 font-mono text-xs max-h-48 overflow-y-auto space-y-1">
          {#each webauthnLog as entry}
            <div class="text-muted-foreground">{entry}</div>
          {/each}
        </div>
      </div>
    {/if}
  </section>
</div>

<StepUpModal />
