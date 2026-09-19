<script lang="ts">
  import qrcode from 'qrcode-generator'
  import { Button } from '$lib/components/ui/button'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { copyText } from '$lib/core/utils/clipboard'
  import { downloadTextFile } from '$lib/core/utils/download'
  import { showSuccessToast, showErrorToast } from '$lib/core/utils/toast'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import DownloadIcon from '@lucide/svelte/icons/download'

  interface Props {
    secretBase32: string
    otpauthUri: string
    /** Verifies the 6-digit code against the pending secret and enables it server-side. */
    onVerify: (code: string) => Promise<{ backupCodes: string[] }>
    onComplete: () => void | Promise<void>
    /** True (default) for a mandatory first-time setup; false for voluntary self-service enrollment. */
    required?: boolean
  }
  let { secretBase32, otpauthUri, onVerify, onComplete, required = true }: Props = $props()

  let step = $state<'enter_code' | 'backup_codes'>('enter_code')
  let code = $state('')
  let error = $state('')
  let submitting = $state(false)
  let backupCodes = $state<string[]>([])

  // Type 0 auto-sizes to the payload; M tolerates a phone camera's usual glare/angle
  // without the QR growing much past the code needed for an otpauth:// URI.
  const qrSvg = $derived.by(() => {
    const qr = qrcode(0, 'M')
    qr.addData(otpauthUri)
    qr.make()
    return qr.createSvgTag({ scalable: true })
  })

  async function copySecret() {
    if (await copyText(secretBase32)) {
      showSuccessToast('Secret key copied')
    } else {
      showErrorToast('Copy failed: clipboard access blocked')
    }
  }

  async function copyBackupCodes() {
    if (await copyText(backupCodes.join('\n'))) {
      showSuccessToast('Backup codes copied')
    } else {
      showErrorToast('Copy failed: clipboard access blocked')
    }
  }

  function downloadBackupCodes() {
    const header = 'mountOS Admin backup codes\nEach code can be used once, in place of a 6-digit authenticator code.\n\n'
    downloadTextFile('mountos-admin-backup-codes.txt', header + backupCodes.join('\n') + '\n')
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = ''
    submitting = true
    try {
      const result = await onVerify(code)
      backupCodes = result.backupCodes
      step = 'backup_codes'
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Invalid code'
    } finally {
      submitting = false
    }
  }
</script>

{#if step === 'enter_code'}
  <form onsubmit={handleSubmit} class="space-y-4">
    <p class="text-sm text-muted-foreground">
      {#if required}Two-factor authentication is required for this account. {/if}Scan this in your
      authenticator app, or enter the key manually, then enter the 6-digit code it shows.
    </p>
    <!-- Fixed white backdrop regardless of theme: a QR code needs strong, stable
         contrast to scan reliably, which dark mode's inverted palette would break. -->
    <div class="flex justify-center rounded-md border bg-white p-4">
      <div
        class="h-56 w-56 [&_svg]:h-full [&_svg]:w-full"
        role="img"
        aria-label="QR code for this account's two-factor secret. Scan it with an authenticator app, or use the key below instead."
      >
        {@html qrSvg}
      </div>
    </div>
    <div class="flex items-center gap-1.5">
      <code class="flex-1 rounded-sm border bg-muted px-2 py-1.5 text-xs break-all">{secretBase32}</code>
      <button
        type="button"
        onclick={copySecret}
        class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8 opacity-70 hover:opacity-100 hover:text-primary transition-opacity"
        title="Copy"
        aria-label="Copy secret key"
      >
        <CopyIcon class="size-3.5" aria-hidden="true" />
      </button>
    </div>
    <div class="space-y-2">
      <Label for="setup-code">6-digit code</Label>
      <Input
        id="setup-code"
        bind:value={code}
        required
        autocomplete="one-time-code"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength={6}
        placeholder="123456"
        class="h-14 text-center text-2xl font-mono tracking-[0.3em]"
      />
    </div>
    {#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}
    <Button variant="primary" type="submit" class="w-full" disabled={submitting}>
      {submitting ? 'Verifying...' : 'Enable and continue'}
    </Button>
  </form>
{:else}
  <div class="space-y-4">
    <p class="text-sm text-muted-foreground">
      Store these backup codes somewhere safe. Each one can be used once if you lose access to your
      authenticator app. They will not be shown again.
    </p>
    <ul class="grid grid-cols-2 gap-2 rounded-md border p-3 font-mono text-sm" aria-label="Backup codes">
      {#each backupCodes as bc (bc)}<li>{bc}</li>{/each}
    </ul>
    <div class="flex gap-2">
      <Button variant="outline" class="flex-1 gap-2" onclick={copyBackupCodes}>
        <CopyIcon class="size-4" aria-hidden="true" />
        Copy
      </Button>
      <Button variant="outline" class="flex-1 gap-2" onclick={downloadBackupCodes}>
        <DownloadIcon class="size-4" aria-hidden="true" />
        Download
      </Button>
    </div>
    <Button variant="primary" class="w-full" onclick={onComplete}>Continue</Button>
  </div>
{/if}
