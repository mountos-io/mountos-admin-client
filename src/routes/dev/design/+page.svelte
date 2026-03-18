<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Badge } from '$lib/components/ui/badge'
  import Button from '$lib/components/ui/button/button.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'

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
</div>
