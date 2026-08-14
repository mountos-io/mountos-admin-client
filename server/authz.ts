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
// Two different models live below, on purpose:
//   - role "user" is DEFAULT-DENY against USER_ROLE_ALLOWED, an explicit
//     (method, path) table. Capabilities are not consulted.
//   - every other role is capability-gated per resource slug, which is
//     default-allow for every path under a slug it holds a capability on.
// Grant a capability to "user" and it leaks sideways to neighbouring paths
// under the same slug; that is why this role does not use them.
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

// Resources not scoped to an account: exempt from the accountId-on-list
// requirement. Regions, storages and clusters are now account-scoped (appserv
// requires accountId), so nothing is exempt.
const GLOBAL_RESOURCES = new Set<string>([])
const VOLUME_ID_PATH = /^\/api\/v1\/volumes\/(\d+)/

// Role "user" is DEFAULT-DENY: a request must match an entry here or it is
// rejected. Capabilities are deliberately not consulted for this role. A
// resource-level grant leaks sideways. Granting `regions` so the volume create
// form can populate its dropdown would otherwise also expose
// /regions/:id/audit-logs and /regions/:id, which are operator surfaces.
// Keep this table to what a permitted screen actually calls.
const USER_ROLE_ALLOWED: Array<[method: string, path: RegExp]> = [
  // Dashboard. Supplies user/volume/region/storage counts on its own, so no
  // users or regions grant is needed to render them.
  ['GET', /^\/api\/v1\/dashboard\/stats$/],
  // Volume create form: region -> storage -> cluster pickers.
  ['GET', /^\/api\/v1\/regions\/list$/],
  ['GET', /^\/api\/v1\/regions\/\d+\/clusters\/list$/],
  ['GET', /^\/api\/v1\/storages\/list$/],
  ['GET', /^\/api\/v1\/storages\/\d+$/],
  // Own audit trail. Account-scoped by appserv; narrowed to the caller's own
  // rows by the createdBy param the proxy force-injects. appserv applies no
  // role policy to that param, so the proxy overwrite is load-bearing.
  ['GET', /^\/api\/v1\/audit-logs\/list$/],
  // Own sessions. The proxy force-injects userId on list/summary.
  ['GET', /^\/api\/v1\/client-sessions\/(list|summary|\d+)$/],
  // Resolves creator/updater ids to names on volume and fork pages.
  // Returns UserLite only (id, username, name); no email, no capabilities.
  ['QUERY', /^\/api\/v1\/users\/bulk$/],
]

// Volumes are allowed as a group rather than enumerated, because appserv scopes
// most of this namespace per volume itself (EnforceUserRoleVolumeAccess). That
// is a property of the handlers, NOT of the path prefix: a volume sub-resource
// that forgets the ownership gate is exposed account-wide by this blanket
// allow. Audit a new /volumes/** endpoint for its own gate before relying on
// this, and deny it below if it has none.
//
// Carved back out: quota is an allocation decision the operator owns
// (quotaLimit is already in USER_ROLE_FORBIDDEN_VOLUME_FIELDS), and
// move-cluster is infra placement, floored to system admin on the POST.
const USER_ROLE_VOLUME_DENIED: RegExp[] = [
  /^\/api\/v1\/volumes\/\d+\/quota$/,
  /^\/api\/v1\/volumes\/\d+\/move-cluster(\/status)?$/,
]

function userRoleAllows(method: string, path: string): boolean {
  if (path.startsWith('/api/v1/volumes/')) {
    return !USER_ROLE_VOLUME_DENIED.some(p => p.test(path))
  }
  return USER_ROLE_ALLOWED.some(([m, p]) => m === method && p.test(path))
}

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
    if (!userRoleAllows(c.req.method, c.req.path)) {
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
    // The allowlist is the whole policy for this role. Capabilities describe
    // what the UI renders and are intentionally narrower in places. `users`
    // stays 0 so the Users nav and pages stay hidden, while QUERY /users/bulk
    // is allowed above purely to resolve ids to display names.
    await next()
    return
  }

  const caps = dashboardAuth.resolveCapabilities(user.role)
  if (((caps[resource] ?? 0) & cap) === 0) {
    return c.json({ status: 'failure', message: 'forbidden' }, 403)
  }

  await next()
}
