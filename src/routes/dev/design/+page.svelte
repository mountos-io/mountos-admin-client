<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import Button from '$lib/components/ui/button/button.svelte'

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
</div>
