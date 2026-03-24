-- Description: Create helper functions (auth helpers, triggers)
-- Date: 2026-03-24
-- Dependencies: 20260324_001_create_organizations.sql, 20260324_002_create_users.sql

-- Returns the organization_id for the currently authenticated user
CREATE OR REPLACE FUNCTION auth.user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT organization_id FROM users WHERE id = auth.uid()
$$;

-- Automatically updates the updated_at column on row modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Trigger: organizations
CREATE OR REPLACE TRIGGER organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: agents
CREATE OR REPLACE TRIGGER agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: guardrail_rules
CREATE OR REPLACE TRIGGER guardrail_rules_updated_at
    BEFORE UPDATE ON guardrail_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: pii_configs
CREATE OR REPLACE TRIGGER pii_configs_updated_at
    BEFORE UPDATE ON pii_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Handles new Supabase Auth user: creates an organization and links the user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_org_id UUID;
    org_slug   TEXT;
BEGIN
    -- Generate a slug from email
    org_slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'))
                || '-' || substring(NEW.id::text, 1, 8);

    -- Create the organization
    INSERT INTO organizations (name, slug)
    VALUES (split_part(NEW.email, '@', 1), org_slug)
    RETURNING id INTO new_org_id;

    -- Link the user
    INSERT INTO users (id, organization_id, email, role)
    VALUES (NEW.id, new_org_id, NEW.email, 'owner');

    RETURN NEW;
END;
$$;

-- Trigger: fires after a new auth.users row is inserted
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
