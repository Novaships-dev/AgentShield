-- Description: Create guardrail_violations table
-- Date: 2026-03-24
-- Dependencies: 20260324_012_create_guardrail_rules.sql

CREATE TABLE IF NOT EXISTS guardrail_violations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id         UUID NOT NULL REFERENCES guardrail_rules(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
    session_id      TEXT,
    violation_type  TEXT NOT NULL,
    matched_content TEXT,
    action_taken    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE guardrail_violations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_guardrail_violations_org ON guardrail_violations (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardrail_violations_rule ON guardrail_violations (rule_id);

COMMENT ON TABLE guardrail_violations IS 'Log of guardrail rule violations for audit and analysis.';
COMMENT ON COLUMN guardrail_violations.matched_content IS 'The content that triggered the violation (may be redacted)';
