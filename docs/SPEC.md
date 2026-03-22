# SPEC.md — Spécifications fonctionnelles AgentShield

> Ce fichier décrit chaque feature en détail fonctionnel. Claude Code le lit avant de coder n'importe quelle feature.
> Cohérent avec : CONTEXT.md (source de vérité), ARCH.md (architecture technique)
> Dernière mise à jour : mars 2026

---

# MODULE MONITOR

## 1. ONBOARDING GUIDÉ

### Flow complet

```
Signup (email ou Google OAuth)
    │
    ├── Step 1 : Welcome
    │   "Welcome to AgentShield. Let's monitor your first AI agent in 2 minutes."
    │   → Création auto organization + plan Free + API key
    │
    ├── Step 2 : Copy your API key
    │   → Afficher une seule fois. Bouton Copy. Warning "save this key".
    │
    ├── Step 3 : Install the SDK
    │   → pip install agentshield
    │   → Tabs : Python SDK / LangChain / CrewAI / API directe / cURL
    │   → Code example avec clé pré-remplie
    │
    ├── Step 4 : Send your first event
    │   → Polling 2s : "Waiting for your first event..."
    │   → Dès qu'un event arrive → confetti + "Your first event! Cost: $0.023"
    │   → Timeout 5min → troubleshooting guide
    │
    └── Step 5 : Go to dashboard
        → Redirect /dashboard avec l'event visible
        → 3 tooltips max sur les éléments clés
```

### Règles métier
- Skippable à tout moment (lien "Skip" discret)
- Reprend au step où l'utilisateur s'est arrêté
- API key nommée "Default Key"
- Plan Free auto, pas de CB requise

---

## 2. DASHBOARD TEMPS RÉEL

### Vue principale (/dashboard)

```
┌─────────────────────────────────────────────────────────────┐
│  AgentShield          [Search] [Alerts 🔴2] [Settings]     │
├────────┬────────────────────────────────────────────────────┤
│        │                                                    │
│ NAV    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │
│        │  │ Today    │ │ This     │ │ Projected│ │Active│ │
│ MONITOR│  │ $12.47   │ │ Month    │ │ EOM      │ │Agents│ │
│ ───────│  │ +23% ▲   │ │ $284.30  │ │ $847 ⚠️  │ │ 7    │ │
│ Dash   │  └──────────┘ └──────────┘ └──────────┘ └──────┘ │
│ Agents │                                                    │
│ Alerts │  [Cost Over Time — live chart via WebSocket]       │
│ Budgets│                                                    │
│ Forecast│ [Cost by Agent] [Cost by Provider]                │
│ Reports│                                                    │
│ Team   │  [Recent Events — live feed, new events slide in]  │
│        │                                                    │
│ REPLAY │                                                    │
│ ───────│                                                    │
│ Sessions│                                                   │
│        │                                                    │
│ PROTECT│                                                    │
│ ───────│                                                    │
│ Guards │                                                    │
│ PII    │                                                    │
│ Violat.│                                                    │
│        │                                                    │
│ ───────│                                                    │
│ Audit  │                                                    │
│ Settings│                                                   │
└────────┴────────────────────────────────────────────────────┘
```

### Sidebar navigation
- Sections groupées par module : MONITOR / REPLAY / PROTECT
- Badge sur chaque section avec le module requis (pour upsell)
- Items grisés si le plan ne donne pas accès au module → clic = upsell modal

### Comportement temps réel
- WebSocket à la connexion du dashboard layout
- Events dans le live feed avec animation slide-in
- Graphiques se mettent à jour live (pas de refresh)
- KPI cards s'incrémentent à chaque event
- Si WS tombe → fallback polling 5s → reconnexion auto exponential backoff

### Filtres
- Date range : Today, Last 7 days, Last 30 days, Custom
- Agent, Provider, Model : dropdown multi-select
- Team : dropdown (Team plan)

---

## 3. TRACKING (POST /v1/track)

### Payload complet

```json
{
    "agent": "my-agent",
    "model": "gpt-4o",
    "provider": "openai",
    "input_tokens": 1250,
    "output_tokens": 340,
    "cost_usd": 0.0234,
    "session_id": "ticket-123",
    "step": 3,
    "step_name": "classify",
    "input_text": "Customer says: I need help with billing",
    "output_text": "Category: billing_inquiry",
    "status": "success",
    "duration_ms": 450,
    "workflow": "customer-support",
    "user_label": "user_456",
    "team_label": "backend-team",
    "metadata": {"version": "2.1"}
}
```

### Champs par module
- **Monitor** : agent, model, provider, input_tokens, output_tokens, cost_usd, workflow, user_label, team_label, metadata
- **Replay** : session_id, step, step_name, input_text, output_text, status, duration_ms
- **Protect** : input_text, output_text (scannés pour PII et guardrails)

### Règles métier
- `agent` est le seul champ strictement requis
- `provider` déduit du model name si non fourni (gpt-* → openai, claude-* → anthropic)
- `cost_usd` calculé automatiquement si non fourni (model + tokens requis)
- `session_id` est un string libre défini par le dev
- `step` est un entier auto-incrémenté dans une session si non fourni
- `input_text` / `output_text` : capturés UNIQUEMENT si le plan inclut Replay (Starter+). Si Free → ignorés silencieusement.
- PII redaction appliquée automatiquement sur input_text/output_text avant stockage
- Events immutables — pas de PUT, pas de DELETE
- Auto-création agent si le nom n'existe pas (dans la limite du plan)

### Réponse

```json
{
    "event_id": "uuid",
    "agent": "my-agent",
    "cost_usd": 0.0234,
    "budget_remaining_usd": 47.23,
    "budget_status": "ok",
    "guardrail_violations": [],
    "pii_detected": ["email"],
    "warnings": []
}
```

---

## 4. AGENTS (CRUD)

### Statuts
- 🟢 Active : events dans les 24h
- 🟡 Warning : anomalie OU budget > 80% OU guardrail violation récente
- 🔴 Frozen : kill switch activé (budget cap atteint)
- ⚫ Inactive : aucun event depuis 7j

### Détail agent (/dashboard/agents/[id])
- Coût over time, répartition par modèle, par session
- Forecast spécifique à cet agent
- Cost Autopilot recommendations
- Budget cap jauge
- Guardrail violations récentes
- Sessions récentes (lien vers Replay)
- Derniers 100 events

---

## 5. ALERTES + SMART ALERTS

### Types d'alertes

| Type | Description | Plan |
|------|-------------|------|
| cost_daily / weekly / monthly | Seuil de coût | Starter+ |
| requests_daily / hourly | Seuil de volume | Starter+ |
| anomaly | Spike auto-détecté (3σ) | Starter+ |
| error_rate | Taux d'erreur dépasse X% | Starter+ |
| guardrail_violation | Violation de guardrail | Pro+ |

### Smart Alert (Pro+)
Quand une alerte se déclenche, un Celery task appelle Claude API pour diagnostiquer la cause probable et suggérer un fix.

**Format notification Slack :**
```
🔴 *Smart Alert* — support-agent
Cost today: *$23.47* (threshold: $20.00)

*Diagnosis:* Step 4 ("generate_response") is using gpt-4o with avg 2400
input tokens — 3x more than last week. A prompt change on March 12
likely increased context length.

*Suggested fix:* Switch step 4 to gpt-4o-mini for simple responses,
or reduce prompt context to <800 tokens.

🔁 <Replay step 4|https://app.agentshield.io/dashboard/sessions/xxx>
```

### Règles métier
- Smart Alerts sont async (Celery) — la notification basique part immédiatement, le diagnostic est ajouté en 10-30s
- Max 20 alert rules par org
- Cooldown configurable : 15min, 30min, 1h, 4h, 24h
- L'historique inclut le diagnostic IA quand disponible

---

## 6. ANOMALY DETECTION

### Fonctionnement standard (voir sections précédentes)
- Phase d'apprentissage 7 jours → baseline mean + stddev
- z-score > 3 = spike, z < -2 = drop
- Automatique pour tous les agents dès Starter, pas de config
- Ajout AgentShield : anomaly detection sur error_rate aussi (pas juste coûts/volume)

---

## 7. COST FORECAST

### Fonctionnement standard
- Linear regression sur coûts daily du mois
- Recalcul Celery toutes les heures
- Min 3 jours pour afficher
- Intervalle de confiance ±15%
- Banner sur le dashboard principal : "Projected: $847 by end of month"

---

## 8. BUDGET CAPS + KILL SWITCH

### Fonctionnement standard, avec ajout :
- Kill switch = mode Freeze renommé pour AgentShield
- Quand kill switch activé → l'agent passe en 🔴 Frozen
- Le SDK lève `BudgetExceededError`
- Lien direct vers Replay de la dernière session coûteuse dans la notification

---

## 9. COST AUTOPILOT (ex-Model Recommendations)

### Fonctionnement identique, rebrandé "Cost Autopilot"
- Celery task hebdomadaire par org
- Analyse via Claude API
- Recommandations chiffrées : "Switch to gpt-4o-mini → save $85/month"
- Plan requis : Pro+
- Ajout AgentShield : le link "Learn more" ouvre la session Replay qui montre les appels coûteux

---

# MODULE REPLAY

## 10. SESSIONS

### User story
En tant que dev, je veux voir exactement ce que mon agent a fait step by step dans une session, pour debugger les problèmes rapidement.

### Liste sessions (/dashboard/sessions)

```
┌──────────────────────────────────────────────────────────────────┐
│ Sessions                          [Filter] [Date range] [Status]│
│                                                                  │
│ ┌──────────┬────────┬──────┬──────────┬──────────┬─────────────┐│
│ │ Session  │ Agents │ Steps│ Cost     │ Duration │ Status      ││
│ ├──────────┼────────┼──────┼──────────┼──────────┼─────────────┤│
│ │ ticket-  │ 3      │ 12   │ $0.47    │ 4m 23s   │ ✅ success  ││
│ │ 123      │        │      │          │          │             ││
│ │ ticket-  │ 2      │ 8    │ $0.31    │ 2m 11s   │ ✅ success  ││
│ │ 124      │        │      │          │          │             ││
│ │ batch-7  │ 1      │ 340  │ $12.87   │ 1h 12m   │ ❌ error    ││
│ │          │        │      │          │          │ (step 287)  ││
│ └──────────┴────────┴──────┴──────────┴──────────┴─────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Filtres sessions
- Date range
- Agent
- Status : success, error, partial, running
- Coût min/max
- Search par session_id

---

## 11. SESSION TIMELINE (Replay core)

### Vue détail (/dashboard/sessions/[id])

```
┌──────────────────────────────────────────────────────────────────┐
│ Session: ticket-123                        [Share] [Export JSON] │
│ Status: ✅ Success | Cost: $0.47 | Duration: 4m 23s | 12 steps  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ TIMELINE                                                   │   │
│ │                                                            │   │
│ │  Step 1 ● ──── Step 2 ● ──── Step 3 ● ──── ... ── Step 12│   │
│ │  classify    retrieve     generate          respond        │   │
│ │  $0.01       $0.02        $0.18             $0.03          │   │
│ │  gpt-4o-mini gpt-4o-mini  gpt-4o ⚠️        gpt-4o-mini   │   │
│ │  120ms       340ms        2.1s              180ms          │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─ Step 3 (selected) ───────────────────────────────────────┐   │
│ │ Agent: responder | Model: gpt-4o | Cost: $0.18 | 2.1s    │   │
│ │                                                            │   │
│ │ INPUT:                                                     │   │
│ │ "Customer says: I need help with my billing. My email is   │   │
│ │ [REDACTED:email] and my card ending in [REDACTED:cc]..."   │   │
│ │                                                            │   │
│ │ OUTPUT:                                                    │   │
│ │ "I'll help you with your billing inquiry. I can see your   │   │
│ │ account associated with [REDACTED:email]..."               │   │
│ │                                                            │   │
│ │ Tokens: 1250 in / 340 out | PII detected: email, cc       │   │
│ │ 💡 Cost Autopilot: "This step could use gpt-4o-mini        │   │
│ │    (save $0.14/call)"                                      │   │
│ └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Interactions timeline
- Clic sur un step → détail s'ouvre en dessous
- Hover sur un step → tooltip avec coût + model + duration
- Steps en erreur → bordure rouge + icône ❌
- Steps avec guardrail violation → bordure orange + icône ⚠️
- Steps avec PII détecté → badge "PII" discret
- Zoom sur une section de la timeline (drag to select)

### Règles métier
- Plan requis : Starter+ (Replay)
- Les inputs/outputs affichés sont TOUJOURS la version redacted (sauf si store_original=true ET l'user a le rôle owner/admin)
- Une session avec 0 steps → "No steps recorded. Make sure you pass session_id and step to the SDK."
- Sessions avec plus de 500 steps → pagination (50 steps par page) avec timeline scrollable
- La timeline est ordonnée par `step` puis par `tracked_at`
- Sessions "running" (dernier event < 30min) → animation pulse sur le dernier step

---

## 12. PARTAGE DE SESSION

### User story
En tant que dev, je veux partager une session de replay avec un collègue via une URL, pour debugger ensemble.

### Flow
1. Clic sur [Share] dans la vue session
2. Modal : "Generate a shareable link" + option d'expiration (1h, 24h, 7j, never)
3. Génération d'un `share_token` unique
4. URL : `https://app.agentshield.io/share/{share_token}`
5. La page /share/[token] affiche la timeline en read-only, sans auth
6. PII toujours redacted dans la vue partagée (même si store_original=true)

### Règles métier
- Plan requis : Pro+
- Max 50 liens de partage actifs par org
- Les liens expirés sont nettoyés par Celery (daily)
- Le share_token est un UUID + 8 chars aléatoires (non prédictible)
- La vue partagée n'a PAS accès au reste du dashboard — uniquement la session
- Pas de données sensibles dans l'URL (pas de session_id, pas d'org_id)

---

## 13. COMPARAISON DE SESSIONS

### User story
En tant que dev, je veux comparer deux sessions côte à côte, pour comprendre pourquoi l'une a coûté plus cher ou a échoué.

### Vue
- Sélectionner 2 sessions dans la liste → bouton "Compare"
- Vue split-screen : timeline gauche / timeline droite
- Highlight des différences : steps manquants, coûts divergents, modèles différents
- KPI comparison : coût total, durée, nb steps, error rate

### Règles métier
- Plan requis : Pro+
- Uniquement 2 sessions à la fois
- Les sessions doivent appartenir à la même org

---

# MODULE PROTECT

## 14. GUARDRAILS CONFIGURABLES

### User story
En tant que responsable IA, je veux définir des règles qui empêchent mes agents de répondre à certains sujets ou d'utiliser certains mots, pour protéger la réputation de mon entreprise.

### Types de guardrails

| Type | Config | Exemple |
|------|--------|---------|
| keyword | Liste de mots interdits | ["competitor_name", "lawsuit", "internal_only"] |
| topic | Catégorie de sujets | ["politics", "religion", "adult_content"] |
| regex | Pattern custom | `\b(password|secret|api_key)\b` |
| category | Liste noire pré-définie | ["hate_speech", "self_harm", "illegal"] |

### Actions par guardrail

| Action | Comportement |
|--------|-------------|
| log | L'event est stocké normalement. La violation est loggée. Notification envoyée. |
| redact | Le contenu matché est remplacé par [BLOCKED:rule_name]. L'event est stocké. |
| block | L'event est rejeté (403). Le SDK lève GuardrailBlockedError. |

### Configuration (/dashboard/guardrails)

```
┌──────────────────────────────────────────────────────────────┐
│ Guardrails                                       [+ New Rule]│
│                                                              │
│ Name              │ Type    │ Agents  │ Action │ Violations  │
│ No competitors    │ keyword │ All     │ block  │ 3 this week │
│ No PII in output  │ regex   │ support │ redact │ 12 today    │
│ Safe topics only  │ topic   │ chatbot │ log    │ 0           │
└──────────────────────────────────────────────────────────────┘
```

### Règles métier
- Plan requis : Pro+
- Max 30 guardrail rules par org
- Les guardrails sont évalués dans l'ordre de création
- Un event peut matcher plusieurs guardrails — toutes les violations sont loggées
- Si un event matche un guardrail "block" ET un guardrail "log" → block gagne
- Les guardrails s'appliquent sur input_text ET output_text
- Les rules "topic" utilisent une classification par mots-clés groupés (pas de ML) pour la V1
- Latence max du check : 5ms (rules cached dans Redis)

---

## 15. PII REDACTION

### User story
En tant que responsable compliance, je veux que les données personnelles soient automatiquement masquées dans les traces, pour être conforme GDPR.

### Patterns supportés (V1)

| Pattern | Exemple | Remplacement |
|---------|---------|-------------|
| email | john@example.com | [REDACTED:email] |
| phone | +33 6 12 34 56 78 | [REDACTED:phone] |
| credit_card | 4111-1111-1111-1111 | [REDACTED:cc] |
| ssn | 123-45-6789 | [REDACTED:ssn] |
| ip_address | 192.168.1.1 | [REDACTED:ip] |
| custom | (regex défini par l'org) | [REDACTED:custom_name] |

### Configuration (/dashboard/pii)

```
┌──────────────────────────────────────────────────────────────┐
│ PII Redaction                                                │
│                                                              │
│ ✅ Enabled (default)                                         │
│                                                              │
│ Active patterns:                                             │
│ ☑ Email addresses                                            │
│ ☑ Phone numbers                                              │
│ ☑ Credit card numbers                                        │
│ ☑ Social Security Numbers                                    │
│ ☐ IP addresses                                               │
│                                                              │
│ Action: [Redact ▼]  (redact / hash / log only)              │
│                                                              │
│ Store original content: [No ▼]                               │
│ ⚠️ If enabled, original unredacted content is stored.        │
│    Only owners and admins can view it.                        │
│                                                              │
│ Custom patterns:                                [+ Add]      │
│ Name: "employee_id" | Pattern: EMP-\d{6}                    │
└──────────────────────────────────────────────────────────────┘
```

### Règles métier
- PII redaction est **activée par défaut** pour toute nouvelle org (privacy by default)
- Plan requis : Pro+ pour la configuration. Free/Starter ont la redaction activée mais pas configurable.
- `store_original=false` par défaut — les textes bruts ne sont JAMAIS stockés sauf opt-in explicite
- La redaction se fait en 2 passes : SDK (avant envoi) + serveur (avant stockage)
- Les custom patterns sont limités à 10 par org
- Le Replay affiche TOUJOURS la version redacted — sauf pour owner/admin avec store_original=true

---

## 16. VIOLATIONS

### Vue violations (/dashboard/violations)

```
┌──────────────────────────────────────────────────────────────┐
│ Violations                            [Filter] [Date range]  │
│                                                              │
│ Time        │ Agent    │ Rule          │ Action  │ Session   │
│ 14:23:01    │ chatbot  │ No competitors│ blocked │ sess-456  │
│ 14:20:15    │ support  │ PII in output │ redacted│ sess-455  │
│ 13:55:03    │ chatbot  │ Safe topics   │ logged  │ sess-451  │
│                                                              │
│ [Click any row → opens the Replay session at the violation]  │
└──────────────────────────────────────────────────────────────┘
```

### Règles métier
- Plan requis : Pro+
- Chaque violation est liée à un event et une session
- Clic sur une violation → ouvre le Replay à ce step exact
- Historique conservé selon la durée du plan
- Exportable en CSV

---

## 17. KILL SWITCH

### User story
En tant que dev, je veux pouvoir couper un agent immédiatement quand quelque chose ne va pas, sans toucher au code.

### Fonctionnement
- Toggle dans la vue agent : [Kill Switch: OFF / ON]
- Quand activé → l'agent passe en 🔴 Frozen
- Tous les appels SDK pour cet agent reçoivent 429 `AgentFrozenError`
- Le kill switch est indépendant du budget cap (peut être activé manuellement)
- Désactivation manuelle uniquement (pas de reset automatique)

### Règles métier
- Plan requis : Pro+
- Le kill switch est immédiat (Redis flag, < 1ms)
- L'activation/désactivation est loggée dans l'audit log
- Notification envoyée quand activé

---

# TRANSVERSAL

## 18. WEBHOOKS SORTANTS

### Événements disponibles
- `event.tracked` — chaque event (batchable)
- `alert.fired` — alerte déclenchée
- `smart_alert.diagnosed` — diagnostic IA disponible
- `anomaly.detected` — anomalie détectée
- `budget.warning` — budget > 80%
- `budget.exceeded` — kill switch auto
- `agent.frozen` — agent frozen (kill switch manuel)
- `session.completed` — session terminée (Replay)
- `guardrail.violated` — violation de guardrail (Protect)
- `pii.detected` — PII détecté (Protect)

### Règles métier
- Plan requis : Pro+
- Max 5 endpoints par org
- Signature HMAC SHA-256 (header X-AGS-Signature)
- Retry : immédiat → 1min → 5min → 30min → 2h (5 tentatives)
- Timeout 10s par requête

---

## 19. TEAM COST ATTRIBUTION

### Fonctionnement standard
- team_label sur events, users, agents (priorité dans cet ordre)
- Vue /dashboard/team avec pie chart + table par équipe
- Plan requis : Team
- Export CSV

---

## 20. AUDIT LOG

### Actions loggées (ajouts AgentShield)
- Inclut toutes les features Monitor, PLUS :
- Guardrail rule created / updated / deleted
- PII config updated
- Kill switch activated / deactivated
- Session shared / share revoked
- Compliance export generated

### Règles métier
- Plan requis : Team
- Immutable, rétention 1 an
- Exportable CSV

---

## 21. SLACK BOT INTERACTIF

### Slash commands (ajouts AgentShield)

```
/shield status      → Résumé Monitor + dernières violations Protect
/shield agent X     → Coût + sessions récentes + violations
/shield session X   → Lien direct vers le Replay
/shield violations  → 5 dernières violations
/shield forecast    → Projected EOM
/shield help        → Liste des commandes
```

### Règles métier
- Plan requis : Team pour le bot (slash commands)
- Alertes simples via webhook Slack dès Starter
- Réponses ephemeral (seul l'user voit)
- Read-only (pas de modification depuis Slack)

---

## 22. RAPPORTS PDF

### Contenu (ajouts AgentShield)
- Inclut toutes les features Monitor, PLUS :
- Top 5 sessions les plus coûteuses du mois (avec lien Replay)
- Résumé des violations de guardrails
- Résumé PII : nombre de redactions par type
- Smart Alert digests : top 3 diagnostics du mois

### Règles métier
- Plan requis : Team
- Max 10 par mois
- Génération async (Celery), max 30s

---

## 23. DASHBOARD PERSONNALISABLE

### Widgets disponibles (ajouts AgentShield)
- Tous les widgets Monitor PLUS :
- Session feed (dernières sessions Replay)
- Violation counter (Protect)
- PII detection counter (Protect)
- Error rate by agent

### Règles métier
- Plan requis : Team
- Max 12 widgets, drag-and-drop
- Config sauvegardée par user

---

## 24. BILLING & PLANS

### Gestion des modules au changement de plan

| Transition | Effet |
|------------|-------|
| Free → Starter | Replay activé. Sessions futures capturées. Pas de rétroactivité. |
| Starter → Pro | Protect activé. Guardrails et PII configurables. |
| Pro → Team | Multi-user, compliance, Slack bot, PDF, audit log. |
| Pro → Starter (downgrade) | Protect désactivé. Guardrails conservés mais inactifs. Données Protect visibles en read-only. |
| Starter → Free (downgrade) | Replay désactivé. Sessions conservées mais non visibles. |

### Règles métier
- Les données ne sont JAMAIS supprimées au downgrade
- Les modules désactivés sont grisés dans la sidebar avec lien upsell
- Le downgrade prend effet à la fin de la période
- Stripe Checkout pour l'upgrade, Stripe Portal pour la gestion

---

## 25. API KEYS

### Format
- Prefix : `ags_live_` (AgentShield live)
- 32 chars aléatoires base62
- SHA-256 hash en DB
- Max 5 clés actives par org

---

## 26. AUTHENTICATION

### Fonctionnement standard
- Email magic link + Google OAuth (Supabase Auth)
- Invitations Team par email
- Rôles : owner, admin, member
- JWT 7 jours avec refresh

---

## 27. LANDING PAGE

### Structure

```
[Nav] Logo — Modules — Pricing — Docs — [Login] [Start Free]

[Hero]
Headline: "Your AI agents are running blind."
Subheadline: "Monitor costs. Replay every session. Protect with guardrails.
              One SDK. One line of code. Full visibility."
CTA: [Start Free — No credit card]
Visual: Dashboard screenshot (dark mode, session replay visible)

[3 Module cards]
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  📊 MONITOR  │ │  🔄 REPLAY   │ │  🛡️ PROTECT  │
│              │ │              │ │              │
│ Track costs  │ │ Debug step   │ │ Guardrails   │
│ Smart alerts │ │ by step      │ │ PII redaction│
│ Forecast     │ │ Share URL    │ │ Kill switch  │
└──────────────┘ └──────────────┘ └──────────────┘

[How it works — 3 steps]
1. Install: pip install agentshield
2. Add one line: @shield(agent="my-agent")
3. See everything: costs, sessions, violations

[Social proof]
"Used by X teams monitoring Y agent sessions"

[Pricing table]
Free / Starter €49 / Pro €99 / Team €199

[Comparison table vs LangSmith / Helicone / Langfuse]

[FAQ] 6-8 questions

[Final CTA]
"Your agents are running. Do you know what they're doing?"
[Start Free — No credit card]

[Footer]
Logo — @NovaShips — Privacy — Terms — Docs
```

### Règles métier
- Dark mode uniquement, couleur violet #7C3AED
- Mobile-first responsive
- < 2s load time (Vercel Edge)
- Code snippets copiables
- Plausible analytics sur CTA

---

> **Règle :** Ce fichier décrit ce que le produit FAIT.
> ARCH.md décrit COMMENT il le fait techniquement.
> Si une spec contredit CONTEXT.md → CONTEXT.md gagne.
> Si une spec contredit ARCH.md → discuter avant de trancher.
