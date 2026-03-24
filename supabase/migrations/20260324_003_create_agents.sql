-- Description: Create agents table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql

CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, name)
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agents_organization ON agents (organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_org_active ON agents (organization_id, is_active);

COMMENT ON TABLE agents IS 'AI agents being monitored. Auto-created on first tracking event.';
COMMENT ON COLUMN agents.name IS 'Unique agent identifier within the organization';
COMMENT ON COLUMN agents.is_active IS 'False when agent is frozen due to budget cap';
