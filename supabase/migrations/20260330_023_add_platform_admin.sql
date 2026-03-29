-- Ajouter un flag platform_admin sur la table users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

-- Marquer novaships.dev@outlook.com comme platform admin
UPDATE users SET is_platform_admin = true WHERE email = 'novaships.dev@outlook.com';

-- Index pour les requetes admin
CREATE INDEX IF NOT EXISTS idx_users_platform_admin ON users (is_platform_admin) WHERE is_platform_admin = true;
