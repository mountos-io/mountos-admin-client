import type { Capabilities, UserInfo } from './adapter'
import { vendorAuthorize } from '$vendor/config/auth'
import { canCreate, canRead, canUpdate, canDelete } from './capabilities'

export type Action = 'create' | 'read' | 'update' | 'delete'

export function authorize(
  caps: Capabilities, resource: string, action: Action, user: UserInfo | null
): boolean {
  const v = vendorAuthorize?.(resource, action, caps, user)
  if (v != null) return v
  switch (action) {
    case 'create': return canCreate(caps, resource)
    case 'read':   return canRead(caps, resource)
    case 'update': return canUpdate(caps, resource)
    case 'delete': return canDelete(caps, resource)
  }
}
