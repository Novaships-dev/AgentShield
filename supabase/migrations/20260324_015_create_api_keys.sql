-- Description: Create api_keys table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql

CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    key_hash        TEXT NOT NULL,
    key_prefix      TEXT NOT NULL,
    last_used_at    TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys (organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys (key_prefix);

COMMENT ON TABLE api_keys IS 'API keys for SDK and direct API access. Stored as SHA-256 hashes.';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the full API key. Never store in plaintext.';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 12 chars of the key (ags_live_xxxx) for identification';
