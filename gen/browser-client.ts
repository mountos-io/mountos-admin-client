import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

// --- Types ---

interface Spec {
  version: string
  basePath: string
  types: Record<string, string[]>
  resources: Resource[]
}

interface Resource {
  name: string
  path: string
  pathParamTypes?: Record<string, string>
  endpoints: Endpoint[]
}

interface Endpoint {
  action: string
  method: string
  path: string
  pagination?: string
  query?: string[]
  request?: string[]
  response?: string[]
  responseType?: string
  responseArray?: boolean
}

interface Field {
  name: string
  type: string
  required: boolean
  optional: boolean
}

// --- Naming ---

const abbrs: Record<string, string> = {
  id: 'ID', url: 'URL', http: 'HTTP', api: 'API', ip: 'IP',
  dns: 'DNS', uri: 'URI', uuid: 'UUID', sql: 'SQL', ssh: 'SSH',
  tcp: 'TCP', udp: 'UDP', jwt: 'JWT', tls: 'TLS', ssl: 'SSL',
}

function splitWords(s: string): string[] {
  const words: string[] = []
  let cur = ''
  const runes = [...s]
  for (let i = 0; i < runes.length; i++) {
    const r = runes[i]
    if (r === '-' || r === '_') {
      if (cur) { words.push(cur); cur = '' }
      continue
    }
    if (i > 0 && r >= 'A' && r <= 'Z') {
      const prev = runes[i - 1]
      if (prev >= 'a' && prev <= 'z') {
        if (cur) { words.push(cur); cur = '' }
      } else if (i + 1 < runes.length && runes[i + 1] >= 'a' && runes[i + 1] <= 'z') {
        if (cur) { words.push(cur); cur = '' }
      }
    }
    cur += r
  }
  if (cur) words.push(cur)
  return words
}

function pascal(s: string): string {
  return splitWords(s).map(w => abbrs[w.toLowerCase()] ?? w[0].toUpperCase() + w.slice(1)).join('')
}

function camel(s: string): string {
  return splitWords(s).map((w, i) => {
    const lo = w.toLowerCase()
    if (i === 0) return abbrs[lo] ? lo : w[0].toLowerCase() + w.slice(1)
    return abbrs[lo] ?? w[0].toUpperCase() + w.slice(1)
  }).join('')
}

function singularize(s: string): string {
  if (s.endsWith('ies')) return s.slice(0, -3) + 'y'
  if (s.endsWith('ses') || s.endsWith('xes')) return s.slice(0, -2)
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1)
  return s
}

function parseField(s: string): Field {
  const idx = s.indexOf(':')
  const name = s.slice(0, idx).trim()
  const rest = s.slice(idx + 1).trim()
  if (rest.includes('=')) return { name, type: rest.slice(0, rest.indexOf('=')), required: false, optional: false }
  if (rest.endsWith('!')) return { name, type: rest.slice(0, -1), required: true, optional: false }
  if (rest.endsWith('?')) return { name, type: rest.slice(0, -1), required: false, optional: true }
  return { name, type: rest, required: false, optional: false }
}

// --- Helpers ---

function reqTypeName(resName: string, action: string): string {
  const words = splitWords(action)
  const sing = singularize(resName)
  if (words.length <= 1) return pascal(action) + sing + 'Request'
  return pascal(words[0]) + sing + words.slice(1).map(w => pascal(w)).join('') + 'Request'
}

function listOptsName(resName: string): string {
  return singularize(resName) + 'ListOptions'
}

function hasReqQuery(query: string[]): boolean {
  return query.some(s => { const f = parseField(s); return f.required && f.name !== 'page' && f.name !== 'limit' })
}

function extractParams(path: string): string[] {
  return path.split('/').filter(s => s.startsWith(':'))
}

function tsType(t: string): string {
  if (t.endsWith('[]')) return tsType(t.slice(0, -2)) + '[]'
  switch (t) {
    case 'string': case 'datetime': return 'string'
    case 'int64': case 'int32': case 'int': return 'number'
    case 'bool': return 'boolean'
    case 'object': return 'Record<string, unknown>'
    case 'json': return 'unknown'
    default: return t
  }
}

function pName(p: string): string {
  const n = p.replace(/^:/, '')
  return n[0] >= 'a' && n[0] <= 'z' ? n : camel(n)
}

function qpName(name: string): string {
  const parts = name.split('_')
  if (parts.length === 1) return name
  return parts[0] + parts.slice(1).map(p => p[0].toUpperCase() + p.slice(1)).join('')
}

function sig(pp: string[], pt?: Record<string, string>): string {
  return pp.map(p => {
    const raw = p.replace(/^:/, '')
    return `${pName(p)}: ${pt?.[raw] ? tsType(pt[raw]) : 'number'}`
  }).join(', ')
}

function pExpr(path: string, pp: string[], pt?: Record<string, string>): string {
  if (!pp.length) return `'${path}'`
  let r = path
  for (const p of pp) {
    const raw = p.replace(/^:/, '')
    const pn = pName(p)
    const isStr = pt?.[raw] === 'string'
    r = r.replace(p, isStr ? `\${encodeURIComponent(${pn})}` : `\${${pn}}`)
  }
  return '`' + r + '`'
}

function inlineResp(resp: string[]): string {
  return '{ ' + resp.map(s => { const f = parseField(s); return `${f.name}: ${tsType(f.type)}` }).join('; ') + ' }'
}

function retType(ep: Endpoint): string {
  if (ep.responseArray) return `${ep.responseType}[]`
  if (ep.responseType && ep.pagination === 'page') return `PaginatedResponse<${ep.responseType}>`
  if (ep.responseType && ep.pagination === 'cursor') return `CursorPaginatedResponse<${ep.responseType}>`
  if (ep.responseType) return ep.responseType
  if (ep.response?.length) return inlineResp(ep.response)
  return 'void'
}

// --- Method generators ---

function genMethod(ep: Endpoint, res: Resource, basePath: string, resPP: string[]): void {
  const epPP = extractParams(ep.path)
  const allPP = [...resPP, ...epPP]
  const mn = camel(ep.action)
  let fp = basePath + ep.path
  fp = fp.replace(/\/$/, '') || '/'
  const pt = res.pathParamTypes

  if (ep.responseArray) return arrayMethod(mn, ep, fp, allPP, pt)
  if (ep.pagination === 'page') return pageMethod(mn, ep, fp, allPP, res.name, pt)
  if (ep.pagination === 'cursor') return cursorMethod(mn, ep, fp, allPP, res.name, pt)
  if (ep.query?.length && !ep.pagination) return queryMethod(mn, ep, fp, allPP, res.name, pt)
  if (ep.request?.length) return bodyMethod(mn, ep, fp, allPP, res.name, pt)
  if (ep.responseType) return getMethod(mn, ep, fp, allPP, pt)
  if (ep.response?.length) return toggleMethod(mn, ep, fp, allPP, pt)
  return voidMethod(mn, ep, fp, allPP, pt)
}

function bodyMethod(mn: string, ep: Endpoint, fp: string, pp: string[], rn: string, pt?: Record<string, string>): void {
  const rt = reqTypeName(rn, ep.action)
  const ret = retType(ep)
  const s = sig(pp, pt)
  const full = s ? `${s}, req: ${rt}` : `req: ${rt}`
  w(`  ${mn}(${full}): Promise<${ret}> {\n`)
  w(`    return this.client.request('${ep.method}', ${pExpr(fp, pp, pt)}, req)\n`)
  w('  }\n')
}

function getMethod(mn: string, ep: Endpoint, fp: string, pp: string[], pt?: Record<string, string>): void {
  w(`  ${mn}(${sig(pp, pt)}): Promise<${ep.responseType}> {\n`)
  w(`    return this.client.request('GET', ${pExpr(fp, pp, pt)})\n`)
  w('  }\n')
}

function toggleMethod(mn: string, ep: Endpoint, fp: string, pp: string[], pt?: Record<string, string>): void {
  w(`  ${mn}(${sig(pp, pt)}): Promise<${inlineResp(ep.response!)}> {\n`)
  w(`    return this.client.request('${ep.method}', ${pExpr(fp, pp, pt)})\n`)
  w('  }\n')
}

function voidMethod(mn: string, ep: Endpoint, fp: string, pp: string[], pt?: Record<string, string>): void {
  w(`  ${mn}(${sig(pp, pt)}): Promise<void> {\n`)
  w(`    return this.client.request('${ep.method}', ${pExpr(fp, pp, pt)})\n`)
  w('  }\n')
}

function arrayMethod(mn: string, ep: Endpoint, fp: string, pp: string[], pt?: Record<string, string>): void {
  w(`  ${mn}(${sig(pp, pt)}): Promise<${ep.responseType}[]> {\n`)
  w(`    return this.client.request('GET', ${pExpr(fp, pp, pt)})\n`)
  w('  }\n')
}

function pageMethod(mn: string, ep: Endpoint, fp: string, pp: string[], rn: string, pt?: Record<string, string>): void {
  const custom = hasReqQuery(ep.query!)
  const ret = `PaginatedResponse<${ep.responseType}>`
  const ot = custom ? listOptsName(rn) : 'ListOptions'
  const oo = custom ? '' : '?'
  const s = sig(pp, pt)
  const full = (s ? `${s}, ` : '') + `opts${oo}: ${ot}`
  const ref = oo === '?' ? 'opts?' : 'opts'
  const qs = ep.query!.map(q => { const f = parseField(q); return `${f.name}: ${ref}.${f.name}` }).join(', ')
  const qsCall = `queryString({ ${qs} })`
  if (pp.length > 0) {
    w(`  ${mn}(${full}): Promise<${ret}> {\n`)
    w(`    return this.client.request('GET', ${pExpr(fp, pp, pt)} + ${qsCall})\n`)
  } else {
    w(`  ${mn}(${full}): Promise<${ret}> {\n`)
    w(`    return this.client.request('GET', \`${fp}\${${qsCall}}\`)\n`)
  }
  w('  }\n')
}

function cursorMethod(mn: string, ep: Endpoint, fp: string, pp: string[], rn: string, pt?: Record<string, string>): void {
  const ot = listOptsName(rn)
  const ret = `CursorPaginatedResponse<${ep.responseType}>`
  const s = sig(pp, pt)
  const full = (s ? `${s}, ` : '') + `opts?: ${ot}`
  const qs = ep.query!.map(q => { const f = parseField(q); return `${f.name}: opts?.${f.name}` })
  const qsCall = `queryString({\n      ${qs.join(',\n      ')},\n    })`
  const pe = pExpr(fp, pp, pt)
  const inner = pe.slice(1, -1)
  w(`  ${mn}(${full}): Promise<${ret}> {\n`)
  w(`    return this.client.request('GET', \`${inner}\${${qsCall}}\`)\n`)
  w('  }\n')
}

function queryMethod(mn: string, ep: Endpoint, fp: string, pp: string[], rn: string, pt?: Record<string, string>): void {
  const ret = retType(ep)
  let s = sig(pp, pt)
  for (const q of ep.query!) {
    const f = parseField(q)
    if (s) s += ', '
    s += `${qpName(f.name)}: ${tsType(f.type)}`
  }
  const qs = ep.query!.map(q => { const f = parseField(q); return `${f.name}: ${qpName(f.name)}` }).join(', ')
  w(`  ${mn}(${s}): Promise<${ret}> {\n`)
  w(`    return this.client.request('GET', \`${fp}\${queryString({ ${qs} })}\`)\n`)
  w('  }\n')
}

// --- Main generator ---

let out = ''
const w = (s: string) => { out += s }

function generate(spec: Spec): string {
  out = ''
  w('// Code generated by gen; DO NOT EDIT.\n\n')
  w("import { ApiError } from './errors.js'\n")
  w('import type {\n')
  w('  StandardResponse, ListOptions,\n')
  w('  PaginatedResponse, CursorPaginatedResponse,\n')

  // Collect type imports
  const seen = new Set<string>()
  const imports: string[] = []
  const add = (n: string) => { if (!seen.has(n)) { seen.add(n); imports.push(n) } }
  for (const res of spec.resources) {
    for (const ep of res.endpoints) {
      if (ep.request?.length) add(reqTypeName(res.name, ep.action))
      if (ep.responseType) add(ep.responseType)
      if (ep.pagination === 'page' && hasReqQuery(ep.query || [])) add(listOptsName(res.name))
      if (ep.pagination === 'cursor') add(listOptsName(res.name))
    }
  }

  // Write type imports in chunks (matching Go line-wrapping at 90 chars)
  let line = '  '
  for (let i = 0; i < imports.length; i++) {
    if (i > 0) line += ', '
    if (line.length + imports[i].length > 90) { w(line + '\n'); line = '  ' }
    line += imports[i]
  }
  if (line.length > 2) w(line + ',\n')
  w("} from '@mountos-app/admin-sdk'\n\n")

  // queryString helper
  w('function queryString(params: Record<string, string | number | undefined>): string {\n')
  w('  const entries = Object.entries(params).filter(([, v]) => v !== undefined)\n')
  w("  if (entries.length === 0) return ''\n")
  w("  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')\n")
  w('}\n\n')

  // ClientConfig
  w('export interface ClientConfig {\n')
  w('  baseUrl?: string\n')
  w('  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>\n')
  w('  onUnauthorized?: () => void\n')
  w('}\n\n')

  // AdminClient class
  w('export class AdminClient {\n')
  w('  readonly baseUrl: string\n')
  w('  private readonly _getHeaders: () => Record<string, string> | Promise<Record<string, string>>\n')
  w('  private readonly _onUnauthorized?: () => void\n\n')

  for (const res of spec.resources) {
    w(`  private _${camel(res.name)}?: ${res.name}Resource\n`)
  }
  w('\n')

  w('  constructor(config: ClientConfig = {}) {\n')
  w("    this.baseUrl = (config.baseUrl ?? '/api/proxy/v1').replace(/\\/+$/, '')\n")
  w('    this._getHeaders = config.getHeaders ?? (() => ({}))\n')
  w('    this._onUnauthorized = config.onUnauthorized\n')
  w('  }\n')

  for (const res of spec.resources) {
    const slug = camel(res.name)
    const cls = `${res.name}Resource`
    w('\n')
    w(`  get ${slug}(): ${cls} {\n`)
    w(`    return (this._${slug} ??= new ${cls}(this))\n`)
    w('  }\n')
  }

  // request method
  w('\n')
  w('  async request<T>(method: string, path: string, body?: unknown): Promise<T> {\n')
  w('    const extra = await this._getHeaders()\n')
  w('    const headers: Record<string, string> = { ...extra }\n\n')
  w("    const init: RequestInit = { method, headers, credentials: 'include' }\n")
  w('    if (body !== undefined) {\n')
  w("      headers['Content-Type'] = 'application/json'\n")
  w('      init.body = JSON.stringify(body)\n')
  w('    }\n\n')
  w('    const res = await fetch(`${this.baseUrl}${path}`, init)\n\n')
  w('    if (res.status === 401) {\n')
  w('      this._onUnauthorized?.()\n')
  w("      throw new ApiError('unauthorized', 401)\n")
  w('    }\n\n')
  w('    let json: StandardResponse<T>\n')
  w('    try {\n')
  w('      json = await res.json() as StandardResponse<T>\n')
  w('    } catch {\n')
  w("      throw new ApiError(res.statusText || 'request failed', res.status)\n")
  w('    }\n\n')
  w("    if (json.status !== 'success') {\n")
  w('      throw new ApiError(json.message, res.status, json.errorCode)\n')
  w('    }\n')
  w('    return json.data as T\n')
  w('  }\n')
  w('}\n')

  // Resource classes
  for (const res of spec.resources) {
    w('\n')
    w(`class ${res.name}Resource {\n`)
    w('  constructor(private client: AdminClient) {}\n')
    const resPP = extractParams(res.path)
    for (const ep of res.endpoints) {
      w('\n')
      genMethod(ep, res, res.path, resPP)
    }
    w('}\n')
  }

  return out
}

// --- Entry ---

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const specPath = join(root, 'node_modules', '@mountos-app', 'admin-sdk', 'api.yaml')
const outPath = join(root, 'src', 'lib', 'core', 'api', 'client.gen.ts')

const spec = parse(readFileSync(specPath, 'utf-8')) as Spec
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, generate(spec))
console.log('browser client generated')
