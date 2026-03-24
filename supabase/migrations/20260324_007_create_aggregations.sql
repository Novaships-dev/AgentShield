-- Description: Create hourly and daily aggregation tables
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql, 20260324_003_create_agents.sql

CREATE TABLE IF NOT EXISTS aggregations_hourly (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    hour            TIMESTAMPTZ NOT NULL,
    total_requests  INT NOT NULL DEFAULT 0,
    total_tokens    INT NOT NULL DEFAULT 0,
    total_cost_usd  DECIMAL(12, 6) NOT NULL DEFAULT 0,
    UNIQUE(organization_id, agent_id, provider, model, hour)
);

ALTER TABLE aggregations_hourly ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agg_hourly_org_hour ON aggregations_hourly (organization_id, hour DESC);
CREATE INDEX IF NOT EXISTS idx_agg_hourly_agent ON aggregations_hourly (agent_id, hour DESC);

COMMENT ON TABLE aggregations_hourly IS 'Pre-computed hourly cost aggregates. Populated by Celery task.';

CREATE TABLE IF NOT EXISTS aggregations_daily (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    day             DATE NOT NULL,
    total_requests  INT NOT NULL DEFAULT 0,
    total_tokens    INT NOT NULL DEFAULT 0,
    total_cost_usd  DECIMAL(12, 6) NOT NULL DEFAULT 0,
    UNIQUE(organization_id, agent_id, provider, model, day)
);

ALTER TABLE aggregations_daily ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agg_daily_org_day ON aggregations_daily (organization_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_agg_daily_agent ON aggregations_daily (agent_id, day DESC);

COMMENT ON TABLE aggregations_daily IS 'Pre-computed daily cost aggregates. Populated by Celery task.';
