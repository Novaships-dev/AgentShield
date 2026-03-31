-- Add modules_enabled column to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS modules_enabled TEXT[] NOT NULL DEFAULT '{}';

-- Set modules_enabled based on current plan
UPDATE organizations SET modules_enabled = '{monitor}' WHERE plan = 'free';
UPDATE organizations SET modules_enabled = '{monitor,replay}' WHERE plan = 'starter';
UPDATE organizations SET modules_enabled = '{monitor,replay,protect}' WHERE plan IN ('pro', 'team');

COMMENT ON COLUMN organizations.modules_enabled IS 'List of enabled modules: monitor, replay, protect';
