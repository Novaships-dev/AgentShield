# TASKS.md — Gestion des tâches AgentShield

> Ce fichier définit l'ordre d'implémentation, les dépendances entre tâches, et les sprints. Claude Code le lit pour savoir QUOI coder et dans QUEL ORDRE.
> Cohérent avec : ARCH.md (structure), SPEC.md (features), DEPLOY.md (infra)
> Dernière mise à jour : mars 2026

---

## 1. PRINCIPE

```
On code dans cet ordre :
  1. Ce qui fait tourner le backend (infra, auth, DB)
  2. Ce qui permet d'ingérer des données (POST /v1/track)
  3. Ce qui montre les données (dashboard)
  4. Ce qui ajoute de la valeur (alertes, replay, protect)
  5. Ce qui fait payer (Stripe, plans)
  6. Ce qui lance (landing page, onboarding)
  7. Ce qui scale (monitoring, optimisation)

Chaque tâche a :
  - Un ID unique (S1-T01 = Sprint 1, Task 01)
  - Des dépendances (ne peut pas commencer avant X)
  - Un livrable vérifiable
  - Un temps estimé
```

---

## 2. SPRINT 0 — FONDATIONS (Semaine 1)

Infrastructure et configuration. Rien de visible pour l'utilisateur. Tout ce qu'il faut pour que le code tourne.

| ID | Tâche | Dépend de | Livrable | Estimé |
|----|-------|-----------|----------|--------|
| S0-T01 | Init backend FastAPI | — | `uvicorn app.main:app` démarre, /health retourne 200 | 1h |
| S0-T02 | Config Pydantic (settings) | S0-T01 | Toutes les env vars chargées, crash si manquant | 1h |
| S0-T03 | Supabase local setup | — | `supabase start` fonctionne, dashboard local accessible | 30min |
| S0-T04 | Migrations initiales (19 tables) | S0-T03 | `supabase db reset` crée toutes les tables + RLS + indexes | 3h |
| S0-T05 | Helper functions SQL | S0-T04 | auth.user_org_id(), update_updated_at(), handle_new_user() | 1h |
| S0-T06 | Seed data (pricing table) | S0-T04 | model_pricing peuplée avec les 14 modèles V1 | 30min |
| S0-T07 | Redis client | S0-T01 | Connexion Redis OK, ping dans /health | 30min |
| S0-T08 | Celery setup | S0-T07 | Worker démarre, task de test s'exécute | 1h |
| S0-T09 | Celery Beat setup | S0-T08 | Beat démarre, task schedulée de test s'exécute | 30min |
| S0-T10 | Init frontend Next.js | — | `npm run dev` démarre, page blanche sur localhost:3000 | 1h |
| S0-T11 | Supabase Auth config | S0-T03 | Email magic link + Google OAuth fonctionnels | 1h |
| S0-T12 | Init SDK package | — | `pip install -e .` fonctionne, import agentshield OK | 1h |
| S0-T13 | Global error handler | S0-T01 | Toutes les exceptions AgentShield retournent le format standard | 1h |
| S0-T14 | Request ID middleware | S0-T01 | Chaque réponse a X-AGS-Request-Id | 30min |

**Total Sprint 0 : ~14h**

---

## 3. SPRINT 1 — CORE INGESTION (Semaine 2)

L'endpoint le plus critique du produit : POST /v1/track + API keys.

| ID | Tâche | Dépend de | Livrable | Estimé |
|----|-------|-----------|----------|--------|
| S1-T01 | API key service (generate, hash, verify) | S0-T04 | Création, vérification, révocation de clés | 2h |
| S1-T02 | API key middleware auth | S1-T01 | Bearer ags_live_xxx vérifié + cache Redis | 1h |
| S1-T03 | POST /v1/api-keys (create) | S1-T01 | Endpoint retourne la clé une seule fois | 1h |
| S1-T04 | GET /v1/api-keys (list) | S1-T01 | Liste les clés (prefix seulement) | 30min |
| S1-T05 | DELETE /v1/api-keys/:id (revoke) | S1-T01 | Révocation immédiate + cache invalidé | 30min |
| S1-T06 | Pricing service | S0-T06 | calculate_cost() fonctionne pour les 14 modèles | 2h |
| S1-T07 | Provider auto-detection | S1-T06 | detect_provider() + model aliases | 1h |
| S1-T08 | POST /v1/track — core | S1-T02, S1-T06 | Ingestion event, calcul coût auto, auto-create agent | 4h |
| S1-T09 | Rate limiting middleware | S0-T07 | Redis sliding window, headers X-RateLimit-* | 2h |
| S1-T10 | Plan limits middleware | S0-T04 | Vérifie agents max + requêtes max par plan | 1h |
| S1-T11 | Tests POST /v1/track | S1-T08 | 10+ tests (happy path, erreurs, edge cases) | 3h |
| S1-T12 | Tests API keys | S1-T03 | 5+ tests | 1h |

**Total Sprint 1 : ~19h**

---

## 4. SPRINT 2 — SDK + SESSIONS (Semaine 3)

SDK Python fonctionnel + base du module Replay.

| ID | Tâche | Dépend de | Livrable | Estimé |
|----|-------|-----------|----------|--------|
| S2-T01 | SDK client HTTP (httpx + retry) | S0-T12 | Client avec retry, timeout, error handling | 3h |
| S2-T02 | SDK @shield() décorateur | S2-T01 | Décorateur sync + async, extraction auto OpenAI/Anthropic | 4h |
| S2-T03 | SDK session() context manager | S2-T02 | Sessions avec auto-increment steps, thread safety | 2h |
| S2-T04 | SDK PII redaction client | S2-T01 | 5 patterns PII, redaction avant envoi | 2h |
| S2-T05 | SDK exceptions complètes | S2-T01 | Hiérarchie complète, mapping API → exceptions | 1h |
| S2-T06 | Session UPSERT backend | S1-T08 | Table sessions mise à jour à chaque event avec session_id | 2h |
| S2-T07 | GET /v1/sessions (liste) | S2-T06 | Liste paginée avec filtres | 2h |
| S2-T08 | GET /v1/sessions/:id (timeline) | S2-T06 | Timeline step-by-step complète | 3h |
| S2-T09 | PII redaction middleware | S0-T04 | Middleware serveur, patterns + custom, store_original | 3h |
| S2-T10 | Tests SDK | S2-T02 | 15+ tests avec respx mock | 3h |
| S2-T11 | Tests sessions | S2-T08 | 5+ tests | 1h |
| S2-T12 | SDK pricing table locale | S2-T01 | Fallback calcul côté client | 1h |

**Total Sprint 2 : ~27h**

---

## 5. SPRINT 3 — DASHBOARD CORE (Semaine 4)

Frontend dashboard avec données temps réel.

| ID | Tâche | Dépend de | Livrable | Estimé |
|----|-------|-----------|----------|--------|
| S3-T01 | Auth frontend (Supabase client) | S0-T10, S0-T11 | Login, signup, session management | 3h |
| S3-T02 | JWT middleware backend | S0-T11 | verify_jwt() pour les endpoints dashboard | 1h |
| S3-T03 | Dashboard layout (sidebar, topnav) | S3-T01 | Layout glassmorphism dark mode | 4h |
| S3-T04 | GET /v1/analytics endpoint | S1-T08 | Données agrégées avec filtres | 3h |
| S3-T05 | Aggregation Celery tasks | S0-T08, S1-T08 | compute_hourly + compute_daily | 3h |
| S3-T06 | Dashboard page principale | S3-T03, S3-T04 | KPI cards + cost over time chart | 4h |
| S3-T07 | Agents list page | S3-T03 | Table agents avec statuts | 2h |
| S3-T08 | Agent detail page | S3-T07 | Métriques, graphiques, derniers events | 3h |
| S3-T09 | WebSocket backend | S0-T07 | /ws/dashboard avec auth JWT, Redis Pub/Sub | 4h |
| S3-T10 | WebSocket frontend hook | S3-T09 | useWebSocket() avec reconnection auto | 2h |
| S3-T11 | Live feed events | S3-T10 | Events en temps réel dans le dashboard | 2h |
| S3-T12 | Charts (Recharts) | S3-T06 | CostOverTime, CostByAgent, CostByProvider, CostByModel | 4h |

**Total Sprint 3 : ~35h**

---

## 6. SPRINT 4 — MONITOR AVANCÉ (Semaine 5)

Alertes, anomaly detection, forecast, budget caps.

| ID | Tâche | Dépend de | Livrable | Estimé |
|----|-------|-----------|----------|--------|
| S4-T01 | Alert rules CRUD | S3-T02 | POST/GET/PUT/DELETE /v1/alerts | 3h |
| S4-T02 | Alert evaluation Celery task | S4-T01, S3-T05 | check_alert_thresholds après chaque event | 3h |
| S4-T03 | Alert notifications (email Brevo) | S4-T02 | Email envoyé quand alerte triggered | 2h |
| S4-T04 | Alert notifications (Slack webhook) | S4-T02 | Slack Block Kit message | 2h |
| S4-T05 | Alerts page frontend | S4-T01 | Liste, création, toggle, historique | 3h |
| S4-T06 | Anomaly detection service | S3-T05 | Baseline calculation, z-score, spike/drop | 4h |
| S4-T07 | Anomaly Celery tasks | S4-T06 | check_anomaly + update_baselines | 2h |
| S4-T08 | Forecast service | S3-T05 | Linear regression, confidence interval | 3h |
| S4-T09 | Forecast Celery task | S4-T08 | recalculate_all toutes les heures | 1h |
| S4-T10 | GET /v1/forecasts | S4-T08 | Endpoint avec projection par org et par agent | 1h |
| S4-T11 | Forecast page frontend | S4-T10 | Graphique projection + breakdown par agent | 3h |
| S4-T12 | Budget caps service | S0-T07 | Redis counter, check, freeze/alert_only | 3h |
| S4-T13 | Budget check middleware | S4-T12 | Middleware sync dans POST /v1/track | 2h |
| S4-T14 | POST/GET /v1/budgets | S4-T12 | CRUD budget caps | 2h |
| S4-T15 | Budgets page frontend | S4-T14 | Liste, création, jauge visuelle | 3h |
| S4-T16 | Kill switch endpoint | S4-T12 | POST /v1/agents/:id/kill-switch | 1h |

**Total Sprint 4 : ~38h**

---

## 7. SPRINT 5 — REPLAY + PROTECT (Semaine 6)

Les deux modules différenciateurs.

| ID | Tâche | Dépend de | Livrable | Estimé |
|----|-------|-----------|----------|--------|
| S5-T01 | Session timeline frontend | S2-T08, S3-T03 | Timeline step-by-step avec step detail | 5h |
| S5-T02 | Session sharing | S5-T01 | POST share, page /share/[token] read-only | 3h |
| S5-T03 | Session comparison | S5-T01 | Vue split-screen, divergence detection | 4h |
| S5-T04 | Sessions list page frontend | S2-T07, S3-T03 | Liste paginée avec filtres et search | 3h |
| S5-T05 | Guardrails service | S0-T04 | Evaluation keyword, regex, topic, category | 4h |
| S5-T06 | Guardrails middleware | S5-T05 | Check sync dans POST /v1/track (block/redact/log) | 2h |
| S5-T07 | POST/GET /v1/guardrails | S5-T05 | CRUD guardrail rules | 2h |
| S5-T08 | Guardrails page frontend | S5-T07 | Liste, création, formulaire par type | 3h |
| S5-T09 | PII config endpoint | S2-T09 | PUT /v1/pii, GET /v1/pii | 1h |
| S5-T10 | PII config page frontend | S5-T09 | Patterns toggle, custom patterns, store_original | 2h |
| S5-T11 | Violations service + endpoint | S5-T06 | Logging async + GET /v1/violations | 2h |
| S5-T12 | Violations page frontend | S5-T11 | Liste avec lien vers Replay | 2h |
| S5-T13 | Smart Alerts (Claude API) | S4-T02 | Celery task diagnostic IA + update alert_history | 3h |
| S5-T14 | Cost Autopilot | S3-T05 | Celery task hebdo + GET /v1/recommendations | 3h |
| S5-T15 | RecommendationCard frontend | S5-T14 | Card avec suggestion + savings | 2h |

**Total Sprint 5 : ~41h**

---

## 8. SPRINT 6 — BILLING + TEAM (Semaine 7)

Stripe, plans, multi-user, audit log.

| ID | Tâche | Dépend de | Livrable | Estimé |
|----|-------|-----------|----------|--------|
| S6-T01 | Stripe products/prices setup | — | 4 plans créés dans Stripe Dashboard | 1h |
| S6-T02 | POST /v1/billing/checkout | S6-T01 | Crée une session Stripe Checkout | 2h |
| S6-T03 | POST /v1/billing/portal | S6-T01 | Ouvre le Stripe Customer Portal | 1h |
| S6-T04 | Stripe webhooks handler | S6-T01 | 5 events gérés + idempotence | 4h |
| S6-T05 | Plan enforcement backend | S6-T04 | modules_enabled, limites, feature gates | 2h |
| S6-T06 | Settings/billing page frontend | S6-T02, S6-T03 | Plan actuel, upgrade, portal link | 3h |
| S6-T07 | Upsell modals frontend | S6-T05 | Feature locked → modal upgrade | 2h |
| S6-T08 | Team invitations | S0-T11 | Invite par email, rôles owner/admin/member | 3h |
| S6-T09 | Team cost attribution | S3-T04 | GET /v1/teams/attribution + page frontend | 3h |
| S6-T10 | Audit log service | S0-T04 | Logging auto des actions admin | 2h |
| S6-T11 | Audit log endpoint + page | S6-T10 | GET /v1/audit + page frontend | 2h |
| S6-T12 | Webhooks sortants service | S0-T08 | Dispatch, signature HMAC, retry | 4h |
| S6-T13 | Webhooks config page frontend | S6-T12 | CRUD endpoints, test button, historique | 3h |
| S6-T14 | Rapports PDF service | S0-T08 | Celery task génération PDF | 4h |
| S6-T15 | Reports page frontend | S6-T14 | Sélection période, génération, download | 2h |

**Total Sprint 6 : ~38h**

---

## 9. SPRINT 7 — LANDING + ONBOARDING + LAUNCH (Semaine 8)

Tout ce que le visiteur/nouveau user voit.

| ID | Tâche | Dépend de | Livrable | Estimé |
|----|-------|-----------|----------|--------|
| S7-T01 | Landing page (template 3D) | S0-T10 | Hero 3D, features, modules, pricing, CTA | 6h |
| S7-T02 | Landing page responsive | S7-T01 | Mobile + tablet | 2h |
| S7-T03 | Onboarding flow (5 steps) | S3-T01, S1-T03 | Guided setup, polling first event | 4h |
| S7-T04 | Slack bot (slash commands) | S4-T04 | /shield status, agent, forecast, violations, help | 4h |
| S7-T05 | Slack OAuth flow | S7-T04 | Connect Slack dans settings | 2h |
| S7-T06 | Dashboard personnalisable | S3-T06 | Widget grid drag-and-drop (Team) | 4h |
| S7-T07 | SDK framework integrations | S2-T02 | LangChain, CrewAI, AutoGen, LlamaIndex callbacks | 6h |
| S7-T08 | Documentation publique (/docs) | S0-T10 | Pages docs SDK + API + quickstart | 4h |
| S7-T09 | SEO + meta tags | S7-T01 | OG image, meta desc, sitemap | 1h |
| S7-T10 | Plausible analytics setup | S7-T01 | Script + events custom | 1h |
| S7-T11 | Sentry setup (backend + frontend) | S0-T01, S0-T10 | Error tracking + performance | 1h |
| S7-T12 | CI/CD pipelines | — | 6 GitHub Actions workflows | 3h |
| S7-T13 | Deploy staging | S7-T12 | Backend Railway + Frontend Vercel + Supabase staging | 2h |
| S7-T14 | Deploy production | S7-T13 | Domaines configurés, SSL, tout fonctionne | 2h |
| S7-T15 | Smoke tests production | S7-T14 | Checklist de vérification post-deploy | 1h |

**Total Sprint 7 : ~43h**

---

## 10. RÉSUMÉ DES SPRINTS

| Sprint | Focus | Estimé | Cumulé |
|--------|-------|--------|--------|
| Sprint 0 | Fondations (infra, DB, config) | 14h | 14h |
| Sprint 1 | Core ingestion (POST /v1/track, API keys) | 19h | 33h |
| Sprint 2 | SDK + Sessions (Replay base) | 27h | 60h |
| Sprint 3 | Dashboard core (frontend, WebSocket) | 35h | 95h |
| Sprint 4 | Monitor avancé (alertes, anomaly, forecast, budgets) | 38h | 133h |
| Sprint 5 | Replay + Protect (timeline, guardrails, PII) | 41h | 174h |
| Sprint 6 | Billing + Team (Stripe, plans, audit, webhooks) | 38h | 212h |
| Sprint 7 | Landing + Onboarding + Launch | 43h | 255h |

**Total estimé : ~255h de dev**
**À 6-8h/jour : 5-6 semaines de dev intense**
**Target launch : mi-avril 2026**

---

## 11. DÉPENDANCES CRITIQUES

```
POST /v1/track (S1-T08) débloque TOUT le reste.
  → C'est la première tâche à coder après les fondations.
  → Sans ingestion, pas de dashboard, pas d'alertes, pas de replay.

Dashboard layout (S3-T03) débloque toutes les pages frontend.
  → Sidebar, topnav, dark mode, responsive.

Stripe webhooks (S6-T04) débloque le billing.
  → Les plans ne fonctionnent pas sans les webhooks.

Landing page (S7-T01) est le dernier blocker avant le launch.
  → Tout le reste peut être en beta, la landing doit être parfaite.
```

---

## 12. RÈGLES DE TASK MANAGEMENT

```
1. Une tâche = un commit (ou quelques commits liés)
2. Chaque tâche a un livrable testable ("ça marche" est vérifiable)
3. Ne pas commencer une tâche si ses dépendances ne sont pas terminées
4. Si une tâche prend 2x plus que l'estimé → la découper
5. Les tests font partie de la tâche (pas une tâche séparée, sauf pour les gros batches)
6. Le doc correspondant est mis à jour dans le même commit si nécessaire
7. Push après chaque tâche terminée (jamais de WIP local overnight)
```

---

> **Règle :** Cet ordre d'implémentation est optimisé pour livrer de la valeur le plus tôt possible.
> POST /v1/track fonctionne dès la semaine 2. Le dashboard est live semaine 4. Le launch est semaine 8.
