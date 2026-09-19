-- Needed to enforce a minimum gap between invite resends, tracked from the
-- issuance time of the most recent token of a given kind for a user.
ALTER TABLE portal_tokens ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX portal_tokens_user_id_kind_created_at_idx ON portal_tokens (user_id, kind, created_at DESC);
