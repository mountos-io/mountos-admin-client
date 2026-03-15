import { AdminClient } from '$lib/core/api/client.gen'
import { authAdapter } from '$lib/config/auth'
import { appConfig } from '$lib/config/app'
import { getStepUpHeaders } from '$lib/core/api/stepup'

export const api = new AdminClient({
  baseUrl: appConfig.proxyBaseUrl,
  getHeaders: async () => ({ ...await authAdapter.getRequestHeaders(), ...getStepUpHeaders() }),
  onUnauthorized: () => authAdapter.signIn(),
  onRefreshToken: () => authAdapter.tryRefreshToken(),
})
