-- Description: Create webhook_endpoints table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    events          TEXT[] NOT NULL DEFAULT '{}',
    secret          TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints (organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org_active ON webhook_endpoints (organization_id, is_active);

COMMENT ON TABLE webhook_endpoints IS 'Outbound webhook destinations configured by users.';
COMMENT ON COLUMN webhook_endpoints.events IS 'List of event types this endpoint subscribes to';
COMMENT ON COLUMN webhook_endpoints.secret IS 'HMAC secret for signing webhook payloads';
