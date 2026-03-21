# MIGRATIONS.md — Stratégie de migrations DB AgentShield

> Ce fichier définit comment créer, nommer, exécuter, et rollback les migrations Supabase. Claude Code le lit avant de toucher au schéma de base de données.
> Cohérent avec : ARCH.md (schéma DB, 19 tables), SECURITY.md (RLS policies)
> Dernière mise à jour : mars 2026

---

## 1. OUTIL ET WORKFLOW

### Outil : Supabase CLI

```bash
# Installer
npm install -g supabase

# Login
supabase login

# Lier au projet
supabase link --project-ref <project-id>

# Créer une migration
supabase migration new <description>

# Appliquer en local
supabase db reset    # Reset complet + replay toutes les migrations
supabase db push     # Appliquer les migrations non exécutées en remote

# Vérifier le statut
supabase migration list
```

### Workflow de migration

```
1. Créer la migration : supabase migration new add_guardrail_rules
   → Crée : supabase/migrations/20260401120000_add_guardrail_rules.sql

2. Écrire le SQL dans le fichier

3. Tester en local : supabase db reset
   → Vérifie que la migration s'applique sur une DB vierge

4. Vérifier le RLS : chaque nouvelle table DOIT avoir RLS + policies

5. Committer : git add . && git commit -m "feat: add guardrail_rules table"

6. Appliquer en staging : supabase db push --linked
   → Vérifie que la migration s'applique sur des données existantes

7. Appliquer en production : supabase db push --linked
   → Après validation staging
```

---

## 2. NAMING DES FICHIERS

### Format

```
{timestamp}_{numéro_séquentiel}_{description}.sql
```

### Exemples

```
supabase/migrations/
├── 20260401_001_create_organizations.sql
├── 20260401_002_create_users.sql
├── 20260401_003_create_agents.sql
├── 20260401_004_create_events.sql
├── 20260401_005_create_sessions.sql
├── 20260401_006_create_shared_sessions.sql
├── 20260401_007_create_aggregations.sql
├── 20260401_008_create_alert_rules.sql
├── 20260401_009_create_alert_history.sql
├── 20260401_010_create_budget_caps.sql
├── 20260401_011_create_anomaly_baselines.sql
├── 20260401_012_create_guardrail_rules.sql
├── 20260401_013_create_guardrail_violations.sql
├── 20260401_014_create_pii_configs.sql
├── 20260401_015_create_api_keys.sql
├── 20260401_016_create_webhook_endpoints.sql
├── 20260401_017_create_webhook_deliveries.sql
├── 20260401_018_create_audit_log.sql
├── 20260401_019_enable_rls_all_tables.sql
├── 20260401_020_create_rls_policies.sql
├── 20260401_021_create_indexes.sql
├── 20260401_022_create_helper_functions.sql
└── 20260401_023_seed_pricing_table.sql
```

### Règles de naming
- Timestamp = date de création (YYYYMMDD)
- Numéro séquentiel à 3 chiffres pour l'ordre d'exécution dans la même journée
- Description en snake_case, verbe en premier (create, add, alter, drop, fix)
- Un fichier par changement logique (pas de mega-migration)

---

## 3. STRUCTURE D'UNE MIGRATION

### Template

```sql
-- ============================================================
-- Migration: 20260401_003_create_agents.sql
-- Description: Create the agents table for tracking AI agent metadata
-- Author: Claude Code
-- Date: 2026-04-01
-- Depends on: 20260401_001_create_organizations.sql
-- ============================================================

-- Create table
CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_frozen       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, name)
);

-- Enable RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "all_own_org_agents" ON agents
    FOR ALL USING (organization_id = auth.user_org_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_org ON agents (organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_org_active ON agents (organization_id) WHERE is_active = true;

-- Comments
COMMENT ON TABLE agents IS 'AI agents tracked by AgentShield';
COMMENT ON COLUMN agents.is_frozen IS 'true when kill switch is active or budget cap exceeded';
```

### Règles
- `IF NOT EXISTS` sur tous les CREATE TABLE et CREATE INDEX (idempotent)
- Commentaire d'en-tête avec description, date, et dépendances
- RLS activé dans la MÊME migration que la table (pas dans une migration séparée, sauf pour le batch initial)
- `COMMENT ON` pour documenter les tables et colonnes non évidentes

---

## 4. ORDRE DES MIGRATIONS INITIALES

L'ordre est critique à cause des foreign keys. Voici l'ordre exact :

```
Phase 1 — Core (pas de FK entre elles)
  001 create_organizations
  002 create_users               → FK organizations

Phase 2 — Agents & Events
  003 create_agents              → FK organizations
  004 create_events              → FK organizations, agents
  005 create_sessions            → FK organizations
  006 create_shared_sessions     → FK organizations

Phase 3 — Agrégations
  007 create_aggregations        → FK organizations, agents (hourly + daily)

Phase 4 — Monitor features
  008 create_alert_rules         → FK organizations, agents
  009 create_alert_history       → FK alert_rules, organizations
  010 create_budget_caps         → FK organizations, agents
  011 create_anomaly_baselines   → FK organizations, agents

Phase 5 — Protect features
  012 create_guardrail_rules     → FK organizations, agents
  013 create_guardrail_violations → FK organizations, guardrail_rules, events, agents
  014 create_pii_configs         → FK organizations

Phase 6 — Infra
  015 create_api_keys            → FK organizations
  016 create_webhook_endpoints   → FK organizations
  017 create_webhook_deliveries  → FK webhook_endpoints
  018 create_audit_log           → FK organizations

Phase 7 — Finition
  019 enable_rls_all_tables      → Batch RLS enable (si pas fait table par table)
  020 create_rls_policies        → Batch policies (si pas fait table par table)
  021 create_indexes             → Indexes additionnels non inclus dans les CREATE TABLE
  022 create_helper_functions    → auth.user_org_id() et autres helpers
  023 seed_pricing_table         → Données initiales pricing par modèle IA
```

---

## 5. HELPER FUNCTIONS

```sql
-- 20260401_022_create_helper_functions.sql

-- ── user_org_id() — Utilisé par toutes les RLS policies ──
CREATE OR REPLACE FUNCTION auth.user_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT organization_id FROM public.users WHERE id = auth.uid()
$$;

COMMENT ON FUNCTION auth.user_org_id IS 'Returns the organization_id of the currently authenticated user. Used by all RLS policies.';

-- ── update_updated_at() — Trigger auto-update ──
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Appliquer le trigger sur les tables avec updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── auto_create_org() — Trigger après signup ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_org_id UUID;
    email_slug TEXT;
BEGIN
    -- Générer un slug depuis l'email
    email_slug := split_part(NEW.email, '@', 1);
    email_slug := regexp_replace(email_slug, '[^a-zA-Z0-9]', '-', 'g');
    email_slug := lower(email_slug);

    -- Vérifier l'unicité du slug (ajouter un suffixe si nécessaire)
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = email_slug) LOOP
        email_slug := email_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
    END LOOP;

    -- Créer l'organisation
    INSERT INTO organizations (name, slug, plan, max_agents, max_requests, history_days, modules_enabled)
    VALUES (email_slug, email_slug, 'free', 1, 10000, 7, '{monitor}')
    RETURNING id INTO new_org_id;

    -- Créer le user avec rôle owner
    INSERT INTO public.users (id, organization_id, email, role)
    VALUES (NEW.id, new_org_id, NEW.email, 'owner');

    -- Créer la config PII par défaut (activée)
    INSERT INTO pii_configs (organization_id, patterns_enabled, action, store_original)
    VALUES (new_org_id, '{email,phone,credit_card,ssn}', 'redact', false);

    RETURN NEW;
END;
$$;

-- Trigger sur auth.users (Supabase Auth)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 6. SEED DATA

### Pricing table (modèles IA)

```sql
-- 20260401_023_seed_pricing_table.sql
-- Stocké dans une table ou dans Redis — ici on utilise une table pour la persistence

CREATE TABLE IF NOT EXISTS model_pricing (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider    TEXT NOT NULL,
    model       TEXT NOT NULL,
    input_per_million_tokens   DECIMAL(10, 4) NOT NULL,
    output_per_million_tokens  DECIMAL(10, 4) NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider, model)
);

-- OpenAI
INSERT INTO model_pricing (provider, model, input_per_million_tokens, output_per_million_tokens) VALUES
    ('openai', 'gpt-4o', 2.50, 10.00),
    ('openai', 'gpt-4o-mini', 0.15, 0.60),
    ('openai', 'gpt-4', 30.00, 60.00),
    ('openai', 'gpt-3.5-turbo', 0.50, 1.50)
ON CONFLICT (provider, model) DO UPDATE SET
    input_per_million_tokens = EXCLUDED.input_per_million_tokens,
    output_per_million_tokens = EXCLUDED.output_per_million_tokens,
    updated_at = now();

-- Anthropic
INSERT INTO model_pricing (provider, model, input_per_million_tokens, output_per_million_tokens) VALUES
    ('anthropic', 'claude-sonnet-4-6', 3.00, 15.00),
    ('anthropic', 'claude-haiku-4-5', 0.80, 4.00),
    ('anthropic', 'claude-opus-4-6', 15.00, 75.00)
ON CONFLICT (provider, model) DO UPDATE SET
    input_per_million_tokens = EXCLUDED.input_per_million_tokens,
    output_per_million_tokens = EXCLUDED.output_per_million_tokens,
    updated_at = now();

-- Google
INSERT INTO model_pricing (provider, model, input_per_million_tokens, output_per_million_tokens) VALUES
    ('google', 'gemini-pro', 1.25, 5.00),
    ('google', 'gemini-flash', 0.075, 0.30)
ON CONFLICT (provider, model) DO UPDATE SET
    input_per_million_tokens = EXCLUDED.input_per_million_tokens,
    output_per_million_tokens = EXCLUDED.output_per_million_tokens,
    updated_at = now();

-- RLS
ALTER TABLE model_pricing ENABLE ROW LEVEL SECURITY;

-- La table pricing est publique en lecture (pas scopée par org)
CREATE POLICY "public_read_pricing" ON model_pricing
    FOR SELECT USING (true);
```

---

## 7. MIGRATIONS POST-LAUNCH

### Ajouter une colonne

```sql
-- 20260415_001_add_agent_tags.sql
-- Description: Add tags column to agents for categorization

ALTER TABLE agents ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN agents.tags IS 'User-defined tags for categorization';
```

### Ajouter une table

```sql
-- 20260415_002_create_saved_views.sql
-- Description: Add saved dashboard views for Team plan customization

CREATE TABLE IF NOT EXISTS saved_views (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    config          JSONB NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_own_org_saved_views" ON saved_views
    FOR ALL USING (organization_id = auth.user_org_id());
```

### Modifier une colonne (avec donnée existante)

```sql
-- 20260420_001_change_budget_cap_precision.sql
-- Description: Increase precision of budget cap amounts

-- Step 1: Add new column
ALTER TABLE budget_caps ADD COLUMN IF NOT EXISTS max_usd_new DECIMAL(14, 4);

-- Step 2: Copy data
UPDATE budget_caps SET max_usd_new = max_usd;

-- Step 3: Drop old, rename new
ALTER TABLE budget_caps DROP COLUMN max_usd;
ALTER TABLE budget_caps RENAME COLUMN max_usd_new TO max_usd;

-- Step 4: Add constraint
ALTER TABLE budget_caps ALTER COLUMN max_usd SET NOT NULL;
```

---

## 8. ROLLBACK

### Principe
Supabase CLI ne supporte pas nativement les rollbacks. La stratégie :

1. **Prévention** : tester chaque migration en local (db reset) + staging avant prod
2. **Forward-only** : si une migration pose problème, écrire une nouvelle migration qui corrige
3. **Rollback scripts** : pour les cas critiques, maintenir un fichier rollback à côté

### Rollback script (optionnel)

```
supabase/migrations/
├── 20260415_002_create_saved_views.sql
└── 20260415_002_create_saved_views.rollback.sql   ← Pas exécuté auto, juste en cas d'urgence
```

```sql
-- 20260415_002_create_saved_views.rollback.sql
-- ⚠️ ROLLBACK — Exécuter manuellement uniquement en cas d'urgence

DROP POLICY IF EXISTS "all_own_org_saved_views" ON saved_views;
DROP TABLE IF EXISTS saved_views;
```

### Règles rollback
- Ne JAMAIS exécuter un rollback en prod sans avoir testé en staging
- Ne JAMAIS DROP une table qui contient des données utilisateur sans backup
- Les rollback scripts ne sont PAS exécutés automatiquement
- Documenter chaque rollback manuel dans CHANGELOG.md

---

## 9. DONNÉES SENSIBLES DANS LES MIGRATIONS

### Ce qui ne va JAMAIS dans une migration
- Des API keys réelles
- Des emails réels
- Des mots de passe
- Des tokens Stripe
- Toute donnée de production

### Ce qui est OK dans les seeds
- Des données de pricing (publiques)
- Des données de démo clairement marquées comme telles
- Des configurations par défaut

---

## 10. CHECKLIST AVANT CHAQUE MIGRATION

```
□ Le fichier suit le naming convention (timestamp_numéro_description.sql)
□ Le SQL est idempotent (IF NOT EXISTS, ON CONFLICT)
□ Le commentaire d'en-tête est présent (description, date, dépendances)
□ Si nouvelle table → RLS activé + policies dans la même migration
□ Si nouvelle table → indexes sur organization_id et les colonnes fréquemment filtrées
□ Si nouvelle table → COMMENT ON TABLE et COMMENT ON COLUMN sur les colonnes non évidentes
□ Testé en local (supabase db reset)
□ Les foreign keys sont correctes (la table référencée existe dans une migration précédente)
□ Pas de données sensibles
□ Pas de DROP TABLE sur des tables avec données (sauf migration de cleanup documentée)
□ Le rollback est documenté (même si c'est juste "créer une nouvelle migration corrective")
```

---

> **Règle :** Chaque changement de schéma DB passe par une migration. Jamais de modification manuelle dans le dashboard Supabase en production.
> Les migrations sont le source of truth du schéma. Si la DB ne correspond pas aux migrations → c'est la DB qui est fausse.
