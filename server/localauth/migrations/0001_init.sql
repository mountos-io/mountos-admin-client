CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE portal_users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               citext NOT NULL UNIQUE,
  name                text NOT NULL,
  role                text NOT NULL,
  account_id          integer,
  appserv_user_id     integer,
  status              text NOT NULL DEFAULT 'invited',
  password_hash       text NOT NULL,
  password_algo       text NOT NULL,
  totp_secret_enc     text,
  totp_enabled_at     timestamptz,
  totp_setup_required boolean NOT NULL DEFAULT false,
  email_verified_at   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_users_status_check CHECK (status IN ('invited', 'active', 'disabled'))
);

CREATE INDEX portal_users_account_id_idx ON portal_users (account_id) WHERE account_id IS NOT NULL;

-- No FK to portal_users (mountOS convention: no foreign keys in schemas).
-- portal_users rows are disabled, never hard-deleted, so orphaning is not a
-- concern in practice; cleanup of these rows is an app-level concern if a
-- user is ever purged.
CREATE TABLE portal_backup_codes (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL,
  code_hash text NOT NULL,
  used_at  timestamptz
);

CREATE INDEX portal_backup_codes_user_id_idx ON portal_backup_codes (user_id);

CREATE TABLE portal_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  kind        text NOT NULL,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT portal_tokens_kind_check CHECK (kind IN ('invite', 'verify_email', 'reset_password'))
);

CREATE INDEX portal_tokens_user_id_kind_idx ON portal_tokens (user_id, kind);
