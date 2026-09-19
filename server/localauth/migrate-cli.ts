// Explicit migration entry point — never called from server.ts boot. Run via
// `make portal-migrate` before deploying a change to migrations/*.sql, matching
// mountos-servers' own no-auto-migration discipline.
import { Pool } from 'pg'
import { migrate } from './migrate'

const databaseUrl = process.env.MOUNTOS_PORTAL_DATABASE_URL
if (!databaseUrl) {
  console.error('MOUNTOS_PORTAL_DATABASE_URL is not set')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
try {
  await migrate(pool)
} finally {
  await pool.end()
}
