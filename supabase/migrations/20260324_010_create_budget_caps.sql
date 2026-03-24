-- Description: Create budget_caps table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql, 20260324_003_create_agents.sql

CREATE TABLE IF NOT EXISTS budget_caps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE,
    max_usd         DECIMAL(12, 2) NOT NULL,
    period          TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
    action          TEXT NOT NULL DEFAULT 'freeze'
                    CHECK (action IN ('freeze', 'alert_only')),
    current_usage   DECIMAL(12, 6) NOT NULL DEFAULT 0,
    is_frozen       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, agent_id, period)
);

ALTER TABLE budget_caps ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_budget_caps_org ON budget_caps (organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_caps_agent ON budget_caps (agent_id) WHERE agent_id IS NOT NULL;

COMMENT ON TABLE budget_caps IS 'Spending limits per agent per period. Triggers auto-freeze when exceeded.';
COMMENT ON COLUMN budget_caps.action IS 'freeze: block the agent; alert_only: notify but allow continued usage';
COMMENT ON COLUMN budget_caps.current_usage IS 'Synced from Redis counter. Updated periodically by Celery.';
COMMENT ON COLUMN budget_caps.is_frozen IS 'True when current_usage >= max_usd and action = freeze';
