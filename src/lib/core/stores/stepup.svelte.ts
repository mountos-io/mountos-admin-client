import { useWebAuthn } from '$lib/core/stores/webauthn.svelte'

export class StepUpCancelledError extends Error {
  constructor() { super('cancelled'); this.name = 'StepUpCancelledError' }
}

export interface StepUpRequest {
  mode: 'register' | 'authenticate'
  resolve: (token: string) => void
  reject: (err: Error) => void
}

let current = $state<StepUpRequest | null>(null)
let queue: { resolve: (token: string) => void; reject: (err: Error) => void }[] = []

function drainQueue(err: Error) {
  for (const q of queue) q.reject(err)
  queue = []
}

export function useStepUp() {
  return {
    get request() { return current },
    complete(token: string) {
      current?.resolve(token)
      current = null
      if (queue.length > 0) startNext()
    },
    cancel() {
      const err = new StepUpCancelledError()
      current?.reject(err)
      current = null
      drainQueue(err)
    },
  }
}

function startNext() {
  const webauthn = useWebAuthn()
  const next = queue.shift()
  if (!next) return
  current = { mode: webauthn.enrolled ? 'authenticate' : 'register', ...next }
}

export function createStepUpHandler(): () => Promise<string> {
  const webauthn = useWebAuthn()
  return () => {
    if (current) {
      return new Promise<string>((resolve, reject) => {
        queue.push({ resolve, reject })
      })
    }
    return new Promise<string>((resolve, reject) => {
      current = { mode: webauthn.enrolled ? 'authenticate' : 'register', resolve, reject }
    })
  }
}
