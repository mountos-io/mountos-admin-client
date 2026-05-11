import { createClient, type RequestFn, type AdminClient } from '@mountos-io/admin-sdk'
import { createBrowserRequest } from '$lib/core/api/request'
import { ApiError } from '$lib/core/api/errors'
import { authAdapter } from '$lib/config/auth'
import { appConfig } from '$lib/config/app'
import { createStepUpHandler } from '$lib/core/stores/stepup.svelte'
import { showErrorToast } from '$lib/core/utils/toast'

const baseRequest = createBrowserRequest({
  baseUrl: appConfig.proxyBaseUrl,
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

export const api: AdminClient = createClient(toastingRequest)
