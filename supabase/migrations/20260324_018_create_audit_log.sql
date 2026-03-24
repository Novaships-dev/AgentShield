-- Description: Create audit_log table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql

CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES auth.users(id),
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     UUID,
    details         JSONB DEFAULT '{}',
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_log_org_time ON audit_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log (resource_type, resource_id);

COMMENT ON TABLE audit_log IS 'Immutable audit trail for all user actions. Team plan only.';
COMMENT ON COLUMN audit_log.action IS 'Action performed (e.g., agent.created, budget.updated, api_key.revoked)';
COMMENT ON COLUMN audit_log.resource_type IS 'Type of resource affected (agent, budget, api_key, etc.)';
