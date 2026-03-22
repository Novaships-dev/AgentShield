# SKILL-MULTI-TENANT.md — Comment gérer le multi-tenant dans AgentShield

> Lire AVANT de créer une table, une query, ou un endpoint qui touche aux données. Réfs : SECURITY.md, ARCH.md (section 8)

---

## PRINCIPE

```
TOUT est scopé par organization_id.
Un user ne voit JAMAIS les données d'une autre org.
Deux couches de protection : code (query filter) + DB (RLS).
```

## CHAQUE QUERY INCLUT organization_id

```python
# ✅ Correct
result = await db.from_("agents").select("*").eq("organization_id", org_id).execute()

# ❌ Interdit — pas de filtre org
result = await db.from_("agents").select("*").eq("id", agent_id).execute()
# → Même si RLS protège, le code DOIT filtrer aussi (defense in depth)
```

## RLS PATTERN

```sql
-- Chaque table (sauf model_pricing) :
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_own_org" ON {table}
    FOR ALL USING (organization_id = auth.user_org_id());
```

## HIÉRARCHIE

```
Organization
├── Users (owner, admin, member) avec team_label
├── Agents
├── Events (avec session_id, team_label)
├── Sessions
├── Alert Rules
├── Budget Caps
├── Anomaly Baselines
├── Guardrail Rules
├── Guardrail Violations
├── PII Configs
├── API Keys
├── Webhook Endpoints
├── Webhook Deliveries
├── Shared Sessions
├── Audit Log
└── Subscription (via Stripe)
```

## PLAN FREE = 1 ORG AUTO

```
Au signup → trigger handle_new_user() :
  1. Créer l'org automatiquement
  2. Créer le user avec rôle owner
  3. Créer la PII config par défaut
  4. Plan Free, 1 agent max, 10K req/mois
```

## TEAM PLAN = MULTI-USER

```
owner invite des membres par email :
  1. Invité reçoit un email avec lien
  2. Au clic → signup/login → ajouté à l'org existante
  3. Rôle assigné : admin ou member
  4. RLS : même org → mêmes données visibles
  5. Permissions : selon le rôle (voir SECURITY.md matrice)
```

## RÈGLES

```
1. organization_id est NOT NULL sur CHAQUE table (sauf model_pricing)
2. organization_id est toujours la première condition dans les queries
3. RLS activé sur les 19 tables
4. Un user appartient à exactement 1 org (pas de multi-org en V1)
5. Le service_role bypass RLS → utilisé uniquement dans le backend
6. Pas de données cross-org dans les réponses API
7. Les share links (Replay) ne donnent accès qu'à 1 session, pas à l'org
```
