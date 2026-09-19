import { Pool } from 'pg'

let pool: Pool | undefined

export function initPortalDb(databaseUrl: string): Pool {
  pool = new Pool({ connectionString: databaseUrl })
  return pool
}

export function portalDb(): Pool {
  if (!pool) throw new Error('portal db not initialized')
  return pool
}
