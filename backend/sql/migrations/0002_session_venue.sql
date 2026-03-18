-- Persist selected venue for session recovery and cross-device sync.

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS venue_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_venue_id
  ON sessions(venue_id)
  WHERE venue_id IS NOT NULL;
