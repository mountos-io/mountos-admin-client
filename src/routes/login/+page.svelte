<script lang="ts">
  import { onMount } from 'svelte'
  import LoginPage from '$provider/pages/login.svelte'
  import LocalLoginForm from '$lib/components/auth/LocalLoginForm.svelte'
  import { fetchLocalLoginEnabled } from '$lib/core/api/localauth'

  let checked = $state(false)
  let localEnabled = $state(false)

  onMount(async () => {
    localEnabled = await fetchLocalLoginEnabled()
    checked = true
  })
</script>

{#if checked}
  {#if localEnabled}
    <LocalLoginForm />
  {:else}
    <LoginPage />
  {/if}
{/if}
