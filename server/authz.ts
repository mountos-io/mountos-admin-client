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
  alerts: 'alerts',
  dashboard: 'dashboard',
  license: 'license',
}

const CREATE_SUFFIXES = ['/create', '/add']

const USER_ROLE_RESOURCES = new Set(['volumes', 'auditLogs', 'dashboard', 'clientSessions', 'regions', 'storages'])
// Resources not scoped to an account: exempt from accountId-on-list requirement
const GLOBAL_RESOURCES = new Set(['regions', 'storages'])
const API_KEY_PATH = /^\/api\/v1\/volumes\/(\d+)\/api-keys\/(generate|revoke(?:-by-user)?)$/
const VOLUME_ID_PATH = /^\/api\/v1\/volumes\/(\d+)/

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
      // List endpoints require accountId unless the resource is globally scoped
      if (!qAccountId && c.req.path.endsWith('/list') && !GLOBAL_RESOURCES.has(resource)) {
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
