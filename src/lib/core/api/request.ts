import type { RequestFn, StandardResponse } from '@mountos-io/admin-sdk'
import { ApiError } from './errors.js'

export interface BrowserClientConfig {
  baseUrl?: string
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
  onUnauthorized?: () => void
  /** Called on 401. Return true if token was refreshed and request should retry. */
  onRefreshToken?: () => Promise<boolean>
  /** Called on 403 step-up-required. Perform WebAuthn ceremony and return step-up token for retry. */
  onStepUpRequired?: () => Promise<string>
}

export function createBrowserRequest(cfg: BrowserClientConfig): RequestFn {
  const baseUrl = (cfg.baseUrl ?? '').replace(/\/+$/, '')
  const getHeaders = cfg.getHeaders ?? (() => ({}))
  let refreshing: Promise<boolean> | null = null

  const coalesceRefresh = (): Promise<boolean> => {
    if (!refreshing) {
      refreshing = cfg.onRefreshToken!().finally(() => { refreshing = null })
    }
    return refreshing
  }

  const doRequest = async <T>(
    method: string, path: string, body: unknown, allowRetry: boolean, signal: AbortSignal | undefined,
  ): Promise<T> => {
    const extra = await getHeaders()
    const headers: Record<string, string> = { ...extra }
    const init: RequestInit = { method, headers, credentials: 'include', signal }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    const res = await fetch(`${baseUrl}${path}`, init)

    if (res.status === 401) {
      if (allowRetry && cfg.onRefreshToken) {
        const refreshed = await coalesceRefresh()
        if (refreshed) return doRequest(method, path, body, false, signal)
      }
      cfg.onUnauthorized?.()
      throw new ApiError('unauthorized', 401)
    }

    if (res.status === 403 && allowRetry && cfg.onStepUpRequired) {
      const rb = await res.json().catch(() => ({})) as Record<string, unknown>
      if (rb.status === 'step-up-required') {
        const token = await cfg.onStepUpRequired()
        return doRetryWithStepUp(method, path, body, token, signal)
      }
      throw new ApiError((rb.message as string) ?? (rb.status as string) ?? 'forbidden', 403)
    }

    return parseJson<T>(res)
  }

  const doRetryWithStepUp = async <T>(
    method: string, path: string, body: unknown, token: string, signal: AbortSignal | undefined, refreshed = false,
  ): Promise<T> => {
    const extra = await getHeaders()
    const headers: Record<string, string> = { ...extra, 'X-StepUp-Token': token }
    const init: RequestInit = { method, headers, credentials: 'include', signal }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    const res = await fetch(`${baseUrl}${path}`, init)

    if (res.status === 401 && !refreshed && cfg.onRefreshToken) {
      const ok = await coalesceRefresh()
      if (ok) return doRetryWithStepUp(method, path, body, token, signal, true)
      cfg.onUnauthorized?.()
      throw new ApiError('unauthorized', 401)
    }

    if (res.status === 401) {
      cfg.onUnauthorized?.()
      throw new ApiError('unauthorized', 401)
    }

    return parseJson<T>(res)
  }

  return <T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> =>
    doRequest<T>(method, path, body, true, signal)
}

async function parseJson<T>(res: Response): Promise<T> {
  let json: StandardResponse<T>
  try {
    json = await res.json() as StandardResponse<T>
  } catch {
    throw new ApiError(res.statusText || 'request failed', res.status)
  }
  if (json.status !== 'success') {
    throw new ApiError(json.message, res.status, json.errorCode)
  }
  return json.data as T
}
