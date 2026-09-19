import type { Pool } from 'pg'
import { PORTAL_STATUS, TOKEN_KIND, type PortalUser, type PortalStatus, type TokenKind } from './types'

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  account_id: number | null
  appserv_user_id: number | null
  status: PortalStatus
  password_hash: string
  password_algo: string
  totp_secret_enc: string | null
  totp_enabled_at: Date | null
  totp_setup_required: boolean
  email_verified_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapUser(row: UserRow): PortalUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    accountId: row.account_id,
    appservUserId: row.appserv_user_id,
    status: row.status,
    passwordHash: row.password_hash,
    passwordAlgo: row.password_algo,
    totpSecretEnc: row.totp_secret_enc,
    totpEnabledAt: row.totp_enabled_at,
    totpSetupRequired: row.totp_setup_required,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class PortalStore {
  constructor(private pool: Pool) {}

  async findByEmail(email: string): Promise<PortalUser | null> {
    const { rows } = await this.pool.query<UserRow>('SELECT * FROM portal_users WHERE email = $1', [email])
    return rows[0] ? mapUser(rows[0]) : null
  }

  async findById(id: string): Promise<PortalUser | null> {
    const { rows } = await this.pool.query<UserRow>('SELECT * FROM portal_users WHERE id = $1', [id])
    return rows[0] ? mapUser(rows[0]) : null
  }

  // Creates an invited user with a placeholder password (never a valid scrypt
  // hash, so login always fails until invite-accept sets a real one).
  async createInvite(params: { email: string; name: string; role: string; accountId?: number; appservUserId?: number }): Promise<PortalUser> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO portal_users (email, name, role, account_id, appserv_user_id, status, password_hash, password_algo)
       VALUES ($1, $2, $3, $4, $5, $6, '', '')
       RETURNING *`,
      [params.email, params.name, params.role, params.accountId ?? null, params.appservUserId ?? null, PORTAL_STATUS.invited],
    )
    return mapUser(rows[0])
  }

  async insertSeedAdmin(params: { email: string; name: string; role: string; passwordHash: string; passwordAlgo: string }): Promise<PortalUser> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO portal_users (email, name, role, status, password_hash, password_algo, totp_setup_required, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, now())
       RETURNING *`,
      [params.email, params.name, params.role, PORTAL_STATUS.active, params.passwordHash, params.passwordAlgo],
    )
    return mapUser(rows[0])
  }

  async createToken(userId: string, kind: TokenKind, tokenHash: string, ttlSeconds: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO portal_tokens (user_id, kind, token_hash, expires_at) VALUES ($1, $2, $3, now() + $4 * interval '1 second')`,
      [userId, kind, tokenHash, ttlSeconds],
    )
  }

  // Issuance time of the most recent token of this kind, consumed or not —
  // the basis for a resend cooldown. Null if none has ever been issued.
  async lastTokenIssuedAt(userId: string, kind: TokenKind): Promise<Date | null> {
    const { rows } = await this.pool.query<{ created_at: Date }>(
      `SELECT created_at FROM portal_tokens WHERE user_id = $1 AND kind = $2 ORDER BY created_at DESC LIMIT 1`,
      [userId, kind],
    )
    return rows[0]?.created_at ?? null
  }

  // Returns the user for a valid (unexpired, unconsumed) token of the given
  // kind, and consumes it atomically. Null if the token is invalid.
  async consumeToken(tokenHash: string, kind: TokenKind): Promise<PortalUser | null> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<{ user_id: string }>(
        `UPDATE portal_tokens SET consumed_at = now()
         WHERE token_hash = $1 AND kind = $2 AND consumed_at IS NULL AND expires_at > now()
         RETURNING user_id`,
        [tokenHash, kind],
      )
      if (!rows[0]) {
        await client.query('ROLLBACK')
        return null
      }
      const { rows: userRows } = await client.query<UserRow>('SELECT * FROM portal_users WHERE id = $1', [rows[0].user_id])
      await client.query('COMMIT')
      return userRows[0] ? mapUser(userRows[0]) : null
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async activateWithPassword(userId: string, passwordHash: string, passwordAlgo: string, requireTotpSetup: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE portal_users
       SET status = $2, password_hash = $3, password_algo = $4, totp_setup_required = $5,
           email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
       WHERE id = $1`,
      [userId, PORTAL_STATUS.active, passwordHash, passwordAlgo, requireTotpSetup],
    )
  }

  async setPassword(userId: string, passwordHash: string, passwordAlgo: string): Promise<void> {
    await this.pool.query(
      `UPDATE portal_users SET password_hash = $2, password_algo = $3, updated_at = now() WHERE id = $1`,
      [userId, passwordHash, passwordAlgo],
    )
  }

  // Switches an existing record onto an admin role (superadmin/l1admin/l2admin).
  // Clears account_id/appserv_user_id: admin roles are never account-scoped, so
  // a record moving off role='user' must drop that linkage rather than carry
  // stale appserv identity. Only forces a fresh TOTP setup if the account
  // doesn't already have one enabled — switching between two admin roles for
  // an already-enrolled operator shouldn't re-trigger mandatory setup.
  async switchToAdminRole(userId: string, role: string): Promise<void> {
    await this.pool.query(
      `UPDATE portal_users
       SET role = $2, account_id = NULL, appserv_user_id = NULL,
           totp_setup_required = (totp_enabled_at IS NULL), updated_at = now()
       WHERE id = $1`,
      [userId, role],
    )
  }

  async enableTotp(userId: string, totpSecretEnc: string): Promise<void> {
    await this.pool.query(
      `UPDATE portal_users SET totp_secret_enc = $2, totp_enabled_at = now(), totp_setup_required = false, updated_at = now() WHERE id = $1`,
      [userId, totpSecretEnc],
    )
  }

  async replaceBackupCodes(userId: string, codeHashes: string[]): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM portal_backup_codes WHERE user_id = $1', [userId])
      for (const hash of codeHashes) {
        await client.query('INSERT INTO portal_backup_codes (user_id, code_hash) VALUES ($1, $2)', [userId, hash])
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async consumeBackupCode(userId: string, codeHash: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      `UPDATE portal_backup_codes SET used_at = now()
       WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
       RETURNING id`,
      [userId, codeHash],
    )
    return rows.length > 0
  }
}

export { TOKEN_KIND }
