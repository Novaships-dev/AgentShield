-- Description: Create users table
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'owner'
                    CHECK (role IN ('owner', 'admin', 'member')),
    team_label      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_users_organization ON users (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

COMMENT ON TABLE users IS 'Application users linked to auth.users and an organization.';
COMMENT ON COLUMN users.role IS 'User role within the organization: owner, admin, or member';
COMMENT ON COLUMN users.team_label IS 'Optional team label for cost attribution (Team plan)';
