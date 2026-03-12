import type { UserInfo } from '$lib/core/auth/adapter'
import { authAdapter } from '$lib/config/auth'

let user = $state<UserInfo | null>(null)
let loading = $state(true)
let initialized = $state(false)

const authenticated = $derived(user !== null)

async function init() {
  if (initialized) return
  loading = true
  try {
    user = await authAdapter.getUser()
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
    init,
    signIn,
    signOut,
  }
}
