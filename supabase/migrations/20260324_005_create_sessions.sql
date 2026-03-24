-- Description: Create sessions table for workflow cost grouping
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql, 20260324_003_create_agents.sql

CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    workflow        TEXT,
    user_label      TEXT,
    team_label      TEXT,
    total_events    INT NOT NULL DEFAULT 0,
    total_tokens    INT NOT NULL DEFAULT 0,
    total_cost_usd  DECIMAL(12, 6) NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}',
    PRIMARY KEY (id, organization_id)
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sessions_organization ON sessions (organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions (agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_org_time ON sessions (organization_id, started_at DESC);

COMMENT ON TABLE sessions IS 'Aggregated cost per session/workflow. Updated on each tracked event.';
COMMENT ON COLUMN sessions.id IS 'Client-provided session identifier';
COMMENT ON COLUMN sessions.workflow IS 'Optional workflow name for grouping sessions';
