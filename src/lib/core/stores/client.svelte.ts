import { createClient, type RequestFn, type AdminClient } from '@mountos-io/admin-sdk'
import { createBrowserRequest } from '$lib/core/api/request'
import { ApiError } from '$lib/core/api/errors'
import { authAdapter } from '$lib/config/auth'
import { createStepUpHandler } from '$lib/core/stores/stepup.svelte'
import { showErrorToast } from '$lib/core/utils/toast'

const baseRequest = createBrowserRequest({
  getHeaders: async () => await authAdapter.getRequestHeaders(),
  onUnauthorized: () => authAdapter.signIn(),
  onRefreshToken: () => authAdapter.tryRefreshToken(),
  onStepUpRequired: createStepUpHandler(),
})

const toastingRequest: RequestFn = async <T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> => {
  try {
    return await baseRequest<T>(method, path, body, signal)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    console.error(`[api] ${method} ${path}`, e)
    if (e instanceof ApiError && e.status >= 500) showErrorToast(e.message)
    else if (!(e instanceof ApiError)) showErrorToast('Unable to connect to server')
    throw e
  }
}

// Coalesce concurrent identical GETs into one in-flight request. Mount/navigation storms
// (layout polling + several components requesting the same resource at once) otherwise fan
// out duplicate calls that needlessly burn the server rate limit. Keyed by path; the shared
// request is aborted only once every awaiting caller has aborted.
type Inflight = { promise: Promise<unknown>; controller: AbortController; refs: number }
const inflightGets = new Map<string, Inflight>()

function dedupedGet<T>(path: string, run: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
  let entry = inflightGets.get(path)
  if (!entry) {
    const controller = new AbortController()
    const promise = run(controller.signal).finally(() => {
      if (inflightGets.get(path)?.controller === controller) inflightGets.delete(path)
    })
    entry = { promise, controller, refs: 0 }
    inflightGets.set(path, entry)
  }
  const shared = entry
  shared.refs++
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    const onAbort = () => {
      cleanup()
      if (--shared.refs <= 0) shared.controller.abort()
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    if (signal) {
      if (signal.aborted) { onAbort(); return }
      signal.addEventListener('abort', onAbort, { once: true })
    }
    shared.promise.then(
      (v) => { cleanup(); resolve(v as T) },
      (e) => { cleanup(); reject(e) },
    )
  })
}

const dedupedRequest: RequestFn = <T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> => {
  if (method !== 'GET') return toastingRequest<T>(method, path, body, signal)
  return dedupedGet<T>(path, (s) => toastingRequest<T>(method, path, body, s), signal)
}

export const api: AdminClient = createClient(dedupedRequest)
