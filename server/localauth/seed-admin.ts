// One-off bootstrap for the very first admin account. Never run automatically —
// invoke explicitly via `make seed-admin`. Inserts directly with
// totp_setup_required=false (see routes.ts/README: this account bypasses the
// invite-accept flow, so it must be able to log in with password alone and
// enable TOTP afterward from settings — otherwise no admin could ever log in
// to complete the mandatory-TOTP setup step).
import { Pool } from 'pg'
import { PortalStore } from './store'
import { hashPassword, PASSWORD_ALGO, MIN_PASSWORD_LENGTH } from './crypto'
import { ROLE, isAdmin } from '../types'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set`)
    process.exit(1)
  }
  return v
}

const databaseUrl = requireEnv('MOUNTOS_PORTAL_DATABASE_URL')
const passwordPepper = requireEnv('MOUNTOS_PORTAL_PASSWORD_PEPPER')
const email = requireEnv('SEED_ADMIN_EMAIL').trim().toLowerCase()
const name = requireEnv('SEED_ADMIN_NAME').trim()
const password = requireEnv('SEED_ADMIN_PASSWORD')
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`)
  process.exit(1)
}
const role = process.env.SEED_ADMIN_ROLE ?? ROLE.superadmin
if (!isAdmin(role)) {
  console.error(`SEED_ADMIN_ROLE must be one of superadmin/l1admin/l2admin, got: ${role}`)
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
try {
  const store = new PortalStore(pool)
  const existing = await store.findByEmail(email)
  if (existing) {
    console.error(`portal_users already has an account for ${email}`)
    process.exit(1)
  }
  const passwordHash = await hashPassword(password, passwordPepper)
  const user = await store.insertSeedAdmin({ email, name, role, passwordHash, passwordAlgo: PASSWORD_ALGO })
  console.log(`Seeded admin ${user.email} (${user.role}), id=${user.id}. TOTP is not yet enabled — set it up after first login.`)
} finally {
  await pool.end()
}
