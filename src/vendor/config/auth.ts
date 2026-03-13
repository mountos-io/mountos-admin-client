import type { AuthAdapter, Capabilities, UserInfo } from '$lib/core/auth/adapter'
import type { Action } from '$lib/core/auth/authorize'

export type AuthorizeCheck = (
  resource: string, action: Action, caps: Capabilities, user: UserInfo | null
) => boolean | null | undefined

export const vendorAuthAdapter: AuthAdapter | undefined = undefined
export const vendorAuthorize: AuthorizeCheck | undefined = undefined
