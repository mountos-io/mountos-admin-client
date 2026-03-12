import { AdminClient } from '$lib/core/api/client.gen'
import { authAdapter } from '$lib/config/auth'
import { appConfig } from '$lib/config/app'

export const api = new AdminClient({
  baseUrl: appConfig.proxyBaseUrl,
  getHeaders: () => authAdapter.getRequestHeaders(),
  onUnauthorized: () => authAdapter.signIn(),
})
