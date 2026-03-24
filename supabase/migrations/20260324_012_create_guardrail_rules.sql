-- Description: Create guardrail_rules table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql, 20260324_003_create_agents.sql

CREATE TABLE IF NOT EXISTS guardrail_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    rule_type       TEXT NOT NULL CHECK (rule_type IN ('pii_detection', 'content_filter', 'token_limit', 'cost_limit')),
    config          JSONB NOT NULL DEFAULT '{}',
    action          TEXT NOT NULL DEFAULT 'block' CHECK (action IN ('block', 'warn', 'redact')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE guardrail_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_guardrail_rules_org ON guardrail_rules (organization_id);
CREATE INDEX IF NOT EXISTS idx_guardrail_rules_org_active ON guardrail_rules (organization_id, is_active);

COMMENT ON TABLE guardrail_rules IS 'Configurable guardrails for blocking, warning, or redacting agent outputs.';
COMMENT ON COLUMN guardrail_rules.config IS 'Rule-specific configuration (patterns, thresholds, etc.)';
COMMENT ON COLUMN guardrail_rules.action IS 'block: reject the request; warn: allow but notify; redact: remove matched content';
