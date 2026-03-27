-- ─────────────────────────────────────────────────────────────────────────────
-- Slack installations (one per organization)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS slack_installations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    slack_team_id       TEXT NOT NULL,
    slack_team_name     TEXT NOT NULL DEFAULT '',
    access_token        TEXT NOT NULL,
    bot_user_id         TEXT NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slack_installations_team_id ON slack_installations(slack_team_id);

-- RLS
ALTER TABLE slack_installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_slack" ON slack_installations
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "org_owner_manage_slack" ON slack_installations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'owner'
        )
    );
