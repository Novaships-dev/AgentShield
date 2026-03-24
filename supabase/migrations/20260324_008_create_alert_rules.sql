-- Description: Create alert_rules table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql, 20260324_003_create_agents.sql

CREATE TABLE IF NOT EXISTS alert_rules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id         UUID REFERENCES agents(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    metric           TEXT NOT NULL
                     CHECK (metric IN ('cost_daily', 'cost_weekly', 'cost_monthly',
                                        'requests_daily', 'requests_hourly', 'anomaly')),
    threshold        DECIMAL(12, 2),
    channel          TEXT NOT NULL
                     CHECK (channel IN ('email', 'slack', 'both', 'webhook')),
    slack_webhook    TEXT,
    webhook_url      TEXT,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    cooldown_minutes INT NOT NULL DEFAULT 60,
    last_triggered   TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules (organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_active ON alert_rules (organization_id, is_active);

COMMENT ON TABLE alert_rules IS 'Threshold-based alert configurations per organization and optional agent.';
COMMENT ON COLUMN alert_rules.cooldown_minutes IS 'Minimum minutes between repeated alerts for the same rule';
COMMENT ON COLUMN alert_rules.last_triggered IS 'Timestamp of last alert dispatch (for cooldown enforcement)';
