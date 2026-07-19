// =============================================================================
// THIS IS THE ACCESS-CONTROL LAYER for the mountOS dashboard plane.
//
// appserv/hub does NOT enforce the role->capability matrix. By contract it only:
//   - treats a signed X-MountOS-Dashboard-User with role="user" as scoped to its
//     own accountId/volumeId (data isolation) and uses userId for audit; every
//     other role, or an absent header, is an unrestricted admin;
//   - keeps a system-admin floor on provider infra it cannot account-scope.
//
// Everything else - which role may call which endpoint, which fields a role may
// set (see USER_ROLE_FORBIDDEN_VOLUME_FIELDS in proxy.ts), the capability map in
// auth.ts - is enforced HERE. This backend is open-source precisely so you can
// fork and change this policy. If you loosen or remove a check here, appserv
// will NOT catch it for you (except account/volume scoping and the infra floor).
//
// One thing appserv DOES validate: a signed dashboard-user header must be
// well-formed (role non-empty; role="user" must carry accountId + userId) or it
// rejects the request. So always sign a complete identity; a partial one is
// treated as an attempted bypass, not a fallback to admin.
// =============================================================================
import type { MiddlewareHandler } from 'hono'
import { dashboardAuth } from './auth'
import { Cap, ROLE } from './types'

const SLUG_TO_RESOURCE: Record<string, string> = {
  accounts: 'accounts',
  users: 'users',
  regions: 'regions',
  // Clusters are sub-resources of regions; cross-region /clusters/list reads are
  // gated by the same capability as region reads.
  clusters: 'regions',
  storages: 'storages',
  volumes: 'volumes',
  'audit-logs': 'auditLogs',
  'client-sessions': 'clientSessions',
  nodes: 'serviceNodes',
  discover: 'discover',
  vault: 'vault',
  metrics: 'metrics',
  alerts: 'alerts',
  dashboard: 'dashboard',
  license: 'license',
}

const CREATE_SUFFIXES = ['/create', '/add']

const USER_ROLE_RESOURCES = new Set(['volumes', 'auditLogs', 'dashboard', 'clientSessions', 'regions', 'storages'])
// Resources not scoped to an account: exempt from the accountId-on-list
// requirement. Regions, storages and clusters are now account-scoped (appserv
// requires accountId), so nothing is exempt.
const GLOBAL_RESOURCES = new Set<string>([])
const API_KEY_PATH = /^\/api\/v1\/volumes\/(\d+)\/api-keys\/(generate|revoke(?:-by-user)?)$/
const VOLUME_ID_PATH = /^\/api\/v1\/volumes\/(\d+)/

// A top-level account-resource list is `/api/v1/<slug>/list`. Region-scoped
// sub-resource lists (e.g. /regions/:id/clusters/list, /regions/:id/audit-logs)
// are path-scoped by the region and do not carry an accountId.
function isTopLevelList(path: string): boolean {
  const segments = path.slice('/api/v1/'.length).split('/')
  return segments.length === 2 && segments[1] === 'list'
}

function extractResource(path: string): string | null {
  const segments = path.slice('/api/v1/'.length).split('/')
  if (!segments[0]) return null
  if (segments[0] === 'regions' && segments.length >= 3 && segments[2] === 'nodes') {
    return 'serviceNodes'
  }
  return SLUG_TO_RESOURCE[segments[0]] ?? null
}

function requiredCap(method: string, path: string): number {
  switch (method) {
    case 'GET':
    case 'HEAD':
    case 'QUERY':
      return Cap.R
    case 'PUT':
    case 'PATCH':
      return Cap.U
    case 'DELETE':
      return Cap.D
    case 'POST':
      return CREATE_SUFFIXES.some(s => path.endsWith(s)) ? Cap.C : Cap.U
    default:
      return 0
  }
}

export const authz: MiddlewareHandler = async (c, next) => {
  const user = c.get('mountosUser')
  if (!user) return c.json({ status: 'failure', message: 'unauthorized' }, 401)

  const resource = extractResource(c.req.path)
  const cap = resource ? requiredCap(c.req.method, c.req.path) : 0
  if (!resource || !cap) return c.json({ status: 'failure', message: 'forbidden' }, 403)

  if (user.role === ROLE.user) {
    if (!USER_ROLE_RESOURCES.has(resource)) {
      return c.json({ status: 'failure', message: 'forbidden' }, 403)
    }
    if (user.accountId != null) {
      const qAccountId = c.req.query('accountId')
      if (qAccountId && Number(qAccountId) !== user.accountId) {
        return c.json({ status: 'failure', message: 'forbidden' }, 403)
      }
      // Top-level account lists require accountId unless globally scoped;
      // region-scoped sub-resource lists are exempt (scoped by the region path).
      if (!qAccountId && isTopLevelList(c.req.path) && !GLOBAL_RESOURCES.has(resource)) {
        return c.json({ status: 'failure', message: 'forbidden' }, 403)
      }
    }
    // Enforce volumeId scoping when set
    if (user.volumeId != null && resource === 'volumes') {
      const match = c.req.path.match(VOLUME_ID_PATH)
      if (match && Number(match[1]) !== user.volumeId) {
        return c.json({ status: 'failure', message: 'forbidden' }, 403)
      }
    }
  }

  const caps = dashboardAuth.resolveCapabilities(user.role)
  if (((caps[resource] ?? 0) & cap) === 0) {
    // Allow user role to access volume API key endpoints (generate/revoke)
    if (user.role === ROLE.user && resource === 'volumes' && cap === Cap.U && API_KEY_PATH.test(c.req.path)) {
      await next()
      return
    }
    return c.json({ status: 'failure', message: 'forbidden' }, 403)
  }

  await next()
}
