-- Durable notification subscriptions and invite lifecycle state.

CREATE TABLE IF NOT EXISTS notification_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expiration_time_ms BIGINT,
  p256dh TEXT,
  auth TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user
  ON notification_subscriptions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS session_invites (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, partner_user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_invites_partner_status
  ON session_invites(partner_user_id, status, updated_at DESC);
