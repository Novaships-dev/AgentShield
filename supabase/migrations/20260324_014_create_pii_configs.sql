-- Description: Create pii_configs table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql

CREATE TABLE IF NOT EXISTS pii_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_types    TEXT[] NOT NULL DEFAULT '{"EMAIL", "PHONE", "SSN", "CREDIT_CARD"}',
    action          TEXT NOT NULL DEFAULT 'redact' CHECK (action IN ('redact', 'block', 'flag')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id)
);

ALTER TABLE pii_configs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pii_configs_org ON pii_configs (organization_id);

COMMENT ON TABLE pii_configs IS 'PII detection configuration per organization.';
COMMENT ON COLUMN pii_configs.entity_types IS 'List of PII entity types to detect (EMAIL, PHONE, SSN, etc.)';
