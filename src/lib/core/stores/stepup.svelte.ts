import { useWebAuthn } from '$lib/core/stores/webauthn.svelte'

export interface StepUpRequest {
  mode: 'register' | 'authenticate'
  resolve: (token: string) => void
  reject: (err: Error) => void
}

let current = $state<StepUpRequest | null>(null)

export function useStepUp() {
  return {
    get request() { return current },
    complete(token: string) { current?.resolve(token); current = null },
    cancel() { current?.reject(new Error('cancelled')); current = null },
  }
}

export function createStepUpHandler(): () => Promise<string> {
  const webauthn = useWebAuthn()
  return () => {
    if (current) return Promise.reject(new Error('step-up already in progress'))
    return new Promise<string>((resolve, reject) => {
      current = { mode: webauthn.enrolled ? 'authenticate' : 'register', resolve, reject }
    })
  }
}
