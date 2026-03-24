-- Description: Create anomaly_baselines table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql, 20260324_003_create_agents.sql

CREATE TABLE IF NOT EXISTS anomaly_baselines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    metric          TEXT NOT NULL CHECK (metric IN ('cost_hourly', 'requests_hourly')),
    hour_of_day     INT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
    day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    mean            DECIMAL(12, 6) NOT NULL DEFAULT 0,
    stddev          DECIMAL(12, 6) NOT NULL DEFAULT 0,
    sample_count    INT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, agent_id, metric, hour_of_day, day_of_week)
);

ALTER TABLE anomaly_baselines ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_anomaly_baselines_org ON anomaly_baselines (organization_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_baselines_agent ON anomaly_baselines (agent_id);

COMMENT ON TABLE anomaly_baselines IS 'Statistical baselines for z-score anomaly detection. Updated by Celery.';
COMMENT ON COLUMN anomaly_baselines.mean IS 'Rolling mean of the metric for this hour/day combination';
COMMENT ON COLUMN anomaly_baselines.stddev IS 'Rolling standard deviation for spike detection (z-score > 3 = anomaly)';
COMMENT ON COLUMN anomaly_baselines.sample_count IS 'Number of observations used in the baseline calculation';
