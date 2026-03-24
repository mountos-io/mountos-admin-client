import { AdminClient } from '$lib/core/api/client.gen'
import { ApiError } from '$lib/core/api/errors'
import { authAdapter } from '$lib/config/auth'
import { appConfig } from '$lib/config/app'
import { createStepUpHandler } from '$lib/core/stores/stepup.svelte'
import { showErrorToast } from '$lib/core/utils/toast'

class ToastingAdminClient extends AdminClient {
  async request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    try {
      return await super.request<T>(method, path, body, signal)
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      console.error(`[api] ${method} ${path}`, e)
      if (e instanceof ApiError && e.status >= 500) showErrorToast(e.message)
      else if (!(e instanceof ApiError)) showErrorToast('Unable to connect to server')
      throw e
    }
  }
}

export const api = new ToastingAdminClient({
  baseUrl: appConfig.proxyBaseUrl,
  getHeaders: async () => await authAdapter.getRequestHeaders(),
  onUnauthorized: () => authAdapter.signIn(),
  onRefreshToken: () => authAdapter.tryRefreshToken(),
  onStepUpRequired: createStepUpHandler(),
})
