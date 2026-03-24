-- Description: Create events (tracking events) table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql, 20260324_003_create_agents.sql

CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    session_id      TEXT,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    input_tokens    INT NOT NULL DEFAULT 0,
    output_tokens   INT NOT NULL DEFAULT 0,
    total_tokens    INT NOT NULL DEFAULT 0,
    cost_usd        DECIMAL(12, 6) NOT NULL,
    workflow        TEXT,
    user_label      TEXT,
    team_label      TEXT,
    metadata        JSONB DEFAULT '{}',
    tracked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_events_org_time ON events (organization_id, tracked_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_agent_time ON events (agent_id, tracked_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_org_agent ON events (organization_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON events (organization_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_team ON events (organization_id, team_label) WHERE team_label IS NOT NULL;

COMMENT ON TABLE events IS 'Core tracking events. High-volume table — partitioning recommended at scale.';
COMMENT ON COLUMN events.session_id IS 'Optional session/workflow identifier for grouping related events';
COMMENT ON COLUMN events.cost_usd IS 'Calculated cost in USD. Computed by backend if not provided by SDK.';
COMMENT ON COLUMN events.metadata IS 'Arbitrary JSON metadata from the SDK caller';
