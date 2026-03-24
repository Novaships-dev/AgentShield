-- Description: Create alert_history table
-- Date: 2026-03-24
-- Dependencies: 20260324_008_create_alert_rules.sql

CREATE TABLE IF NOT EXISTS alert_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_rule_id   UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    triggered_value DECIMAL(12, 6) NOT NULL,
    threshold       DECIMAL(12, 2) NOT NULL,
    channel         TEXT NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_alert_history_org ON alert_history (organization_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history (alert_rule_id, sent_at DESC);

COMMENT ON TABLE alert_history IS 'Immutable log of all alerts dispatched.';
COMMENT ON COLUMN alert_history.triggered_value IS 'The metric value that triggered the alert';
