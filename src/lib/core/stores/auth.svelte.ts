import type { Capabilities, UserInfo } from '$lib/core/auth/adapter'
import { authorize, type Action } from '$lib/core/auth/authorize'
import { authAdapter } from '$lib/config/auth'
import { showErrorToast } from '$lib/core/utils/toast'
import { useWebAuthn } from '$lib/core/stores/webauthn.svelte'

const webauthn = useWebAuthn()

let user = $state<UserInfo | null>(null)
let loading = $state(true)
let initialized = $state(false)

const authenticated = $derived(user !== null)
const capabilities = $derived<Capabilities>(user?.capabilities ?? {})
const isUserRole = $derived(user?.role === 'user')
const userAccountId = $derived(user?.accountId ?? null)
const userMountosUserId = $derived(user?.userId ?? null)
const userVolumeId = $derived(user?.volumeId ?? null)

function can(resource: string, action: Action): boolean {
  return authorize(capabilities, resource, action, user)
}

function guard(resource: string, action: Action): boolean {
  if (can(resource, action)) return true
  showErrorToast('Not authorized')
  return false
}

async function init() {
  if (initialized) return
  loading = true
  try {
    user = await authAdapter.getUser()
    webauthn.setEnrollmentState(user?.webauthn)
  } finally {
    loading = false
    initialized = true
  }
}

async function signIn() {
  await authAdapter.signIn()
}

async function signOut() {
  await authAdapter.signOut()
  user = null
}

export function useAuth() {
  return {
    get user() { return user },
    get loading() { return loading },
    get authenticated() { return authenticated },
    get capabilities() { return capabilities },
    get isUserRole() { return isUserRole },
    get userAccountId() { return userAccountId },
    get userMountosUserId() { return userMountosUserId },
    get userVolumeId() { return userVolumeId },
    can,
    guard,
    init,
    signIn,
    signOut,
  }
}
