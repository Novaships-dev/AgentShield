-- Description: Create organizations table
-- Date: 2026-03-24
-- Dependencies: none

CREATE TABLE IF NOT EXISTS organizations (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   TEXT NOT NULL,
    slug                   TEXT UNIQUE NOT NULL,
    plan                   TEXT NOT NULL DEFAULT 'free'
                           CHECK (plan IN ('free', 'starter', 'pro', 'team')),
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    max_agents             INT NOT NULL DEFAULT 1,
    max_requests           INT NOT NULL DEFAULT 10000,
    history_days           INT NOT NULL DEFAULT 7,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations (slug);

COMMENT ON TABLE organizations IS 'Top-level tenant entity. Each organization has a plan and billing info.';
COMMENT ON COLUMN organizations.slug IS 'URL-safe unique identifier for the organization';
COMMENT ON COLUMN organizations.plan IS 'Subscription plan: free, starter, pro, or team';
COMMENT ON COLUMN organizations.max_agents IS 'Maximum number of agents allowed by plan';
COMMENT ON COLUMN organizations.max_requests IS 'Maximum tracking events per month allowed by plan';
COMMENT ON COLUMN organizations.history_days IS 'Number of days of event history retained';
