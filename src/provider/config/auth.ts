import type { AuthAdapter, Capabilities, UserInfo } from '#lib/core/auth/adapter.js'
import type { Action } from '#lib/core/auth/authorize.js'

export type AuthorizeCheck = (
  resource: string, action: Action, caps: Capabilities, user: UserInfo | null
) => boolean | null | undefined

export const providerAuthAdapter: AuthAdapter | undefined = undefined
export const providerAuthorize: AuthorizeCheck | undefined = undefined
