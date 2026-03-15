import { AdminClient } from '$lib/core/api/client.gen'
import { authAdapter } from '$lib/config/auth'
import { appConfig } from '$lib/config/app'
import { createStepUpHandler } from '$lib/core/stores/stepup.svelte'

export const api = new AdminClient({
  baseUrl: appConfig.proxyBaseUrl,
  getHeaders: async () => await authAdapter.getRequestHeaders(),
  onUnauthorized: () => authAdapter.signIn(),
  onRefreshToken: () => authAdapter.tryRefreshToken(),
  onStepUpRequired: createStepUpHandler(),
})
