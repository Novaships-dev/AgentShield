-- Description: Create shared_sessions table for cross-agent session sharing
-- Date: 2026-03-24
-- Dependencies: 20260324_005_create_sessions.sql

CREATE TABLE IF NOT EXISTS shared_sessions (
    session_id      TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    shared_with     UUID[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, organization_id)
);

ALTER TABLE shared_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_shared_sessions_org ON shared_sessions (organization_id);

COMMENT ON TABLE shared_sessions IS 'Tracks which sessions are shared across agent boundaries.';
COMMENT ON COLUMN shared_sessions.shared_with IS 'Array of organization IDs that can view this session';
