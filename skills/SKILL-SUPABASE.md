# SKILL-SUPABASE.md — Comment interagir avec Supabase dans AgentShield

> Lire AVANT de toucher à la DB, aux migrations, à l'auth, ou au RLS.
> Réfs : MIGRATIONS.md, SECURITY.md, ARCH.md (section 3)

---

## CLIENTS

```python
# Backend — Service role (bypass RLS, pour les opérations serveur)
from supabase import create_client
client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Backend — Anon (respecte RLS, pour les requêtes user-scoped)
anon_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# RÈGLE : utiliser service_role dans les Celery tasks et les endpoints API key
#          utiliser anon + JWT dans les endpoints dashboard (RLS s'applique)
```

```typescript
// Frontend — Browser client
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
const supabase = createBrowserSupabaseClient();

// Frontend — Server component
import { createServerSupabaseClient } from "@/lib/supabase/server";
const supabase = createServerSupabaseClient();
```

## QUERIES — PATTERNS

```python
# SELECT avec filtres
result = await db.from_("agents") \
    .select("id, name, is_active, created_at") \
    .eq("organization_id", org_id) \
    .eq("is_active", True) \
    .order("created_at", desc=True) \
    .limit(50) \
    .execute()

agents = result.data  # list[dict]

# SELECT single
result = await db.from_("agents") \
    .select("*") \
    .eq("id", agent_id) \
    .eq("organization_id", org_id) \
    .single() \
    .execute()

agent = result.data  # dict or None

# INSERT
result = await db.from_("agents") \
    .insert({
        "organization_id": org_id,
        "name": agent_name,
        "description": description,
    }) \
    .execute()

# UPSERT (INSERT ... ON CONFLICT UPDATE)
result = await db.from_("sessions") \
    .upsert({
        "organization_id": org_id,
        "session_id": session_id,
        "total_steps": total_steps,
        "total_cost_usd": total_cost,
        "status": "running",
        "started_at": started_at,
    }, on_conflict="organization_id,session_id") \
    .execute()

# UPDATE
result = await db.from_("agents") \
    .update({"is_frozen": True, "updated_at": "now()"}) \
    .eq("id", agent_id) \
    .eq("organization_id", org_id) \
    .execute()

# DELETE (soft — préféré)
result = await db.from_("agents") \
    .update({"is_active": False}) \
    .eq("id", agent_id) \
    .execute()

# COUNT
result = await db.from_("events") \
    .select("id", count="exact") \
    .eq("organization_id", org_id) \
    .execute()

count = result.count
```

## RLS — RAPPEL

```
CHAQUE table a RLS activé.
CHAQUE requête est scopée par organization_id.

Pattern RLS commun :
  FOR ALL USING (organization_id = auth.user_org_id())

Le service_role KEY bypass le RLS.
→ OBLIGATOIRE pour : Celery tasks, ingestion via API key, signup trigger
→ INTERDIT pour : requêtes frontend, tout ce qui passe par le JWT user
```

## MIGRATIONS — WORKFLOW

```bash
# Créer une migration
supabase migration new add_column_agents_tags

# Écrire le SQL dans supabase/migrations/XXXXXXX_add_column_agents_tags.sql

# Tester
supabase db reset  # Replay TOUTES les migrations from scratch

# Appliquer en remote
supabase db push
```

## AUTH — PATTERNS

```python
# Vérifier un JWT
import jwt

def verify_jwt(token: str) -> dict:
    payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
    return payload  # {"sub": user_id, "email": ..., "role": ...}

# Récupérer l'org depuis le JWT
async def get_org_from_jwt(token: str) -> Organization:
    payload = verify_jwt(token)
    user_id = payload["sub"]
    user = await db.from_("users").select("*, organizations(*)").eq("id", user_id).single().execute()
    return Organization.from_db(user.data["organizations"])
```

## CE QU'ON NE FAIT JAMAIS

```
1. Pas de SQL brut concaténé (injection risk) → toujours le query builder
2. Pas de service_role key dans le frontend
3. Pas de table sans RLS
4. Pas de migration sans IF NOT EXISTS
5. Pas de DROP TABLE en migration normale
6. Pas de données sensibles dans les seeds
7. Pas de requête sans filtre organization_id (sauf model_pricing qui est publique)
```
