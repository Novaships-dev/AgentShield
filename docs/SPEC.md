# SPEC.md — Spécifications fonctionnelles AgentCostGuard

> Ce fichier décrit chaque feature en détail fonctionnel. Claude Code le lit avant de coder n'importe quelle feature pour comprendre exactement ce que l'utilisateur voit, ce qu'il fait, et ce qui se passe derrière.
> Cohérent avec : CONTEXT.md (source de vérité), ARCH.md (architecture technique)
> Dernière mise à jour : mars 2026

---

## 1. ONBOARDING GUIDÉ

### User story
En tant que nouveau dev, je veux être guidé step-by-step de l'inscription à mon premier event tracké, pour que je voie la valeur du produit en moins de 5 minutes.

### Flow complet

```
Signup (email ou Google OAuth)
    │
    ├── Step 1 : Welcome screen
    │   "Welcome to AgentCostGuard. Let's track your first AI cost in under 2 minutes."
    │   → Création automatique de l'organization + plan Free
    │   → Génération automatique d'une API key
    │
    ├── Step 2 : Copy your API key
    │   → Afficher la clé (une seule fois, en clair)
    │   → Bouton "Copy" avec confirmation visuelle
    │   → Warning : "Save this key. You won't see it again."
    │
    ├── Step 3 : Install the SDK
    │   → Code block copiable : pip install agentcostguard
    │   → Tab switch : Python SDK / API directe / cURL
    │   → Code example complet avec la clé pré-remplie
    │
    ├── Step 4 : Send your first event
    │   → Polling toutes les 2s : "Waiting for your first event..."
    │   → Animation pulse sur le bouton
    │   → Dès qu'un event arrive → confetti animation
    │   → "Your first event is tracked! Cost: $0.0234"
    │
    └── Step 5 : Go to dashboard
        → Redirect vers /dashboard avec l'event visible
        → Tooltip tour (3 tooltips max) sur les éléments clés
```

### Règles métier
- L'onboarding est skippable à tout moment (lien "Skip" discret)
- Si l'utilisateur revient sans avoir terminé, reprendre au step où il s'est arrêté
- L'API key générée à l'onboarding est nommée "Default Key"
- Le plan Free est activé automatiquement, pas de carte bancaire requise
- Le step 4 a un timeout de 5 minutes. Après → "No event yet? Check our troubleshooting guide" + lien vers /docs

### Edge cases
- L'utilisateur s'inscrit avec Google OAuth mais a déjà un compte email → merge automatique
- L'utilisateur ferme le navigateur au step 3 → l'org et la key existent déjà, reprendre au step 3
- Deux signups simultanés avec le même email → Supabase Auth gère le conflit

---

## 2. DASHBOARD TEMPS RÉEL

### User story
En tant que dev, je veux voir mes coûts IA apparaître en temps réel sur le dashboard, sans refresh, pour avoir une visibilité instantanée.

### Vue principale (/dashboard)

```
┌─────────────────────────────────────────────────────────────┐
│  AgentCostGuard          [Search] [Alerts 🔴2] [Settings]  │
├────────┬────────────────────────────────────────────────────┤
│        │                                                    │
│ NAV    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │
│        │  │ Today    │ │ This     │ │ Projected│ │Active│ │
│ Dash   │  │ $12.47   │ │ Month    │ │ EOM      │ │Agents│ │
│ Agents │  │ +23% ▲   │ │ $284.30  │ │ $847 ⚠️  │ │ 7    │ │
│ Sessions│ └──────────┘ └──────────┘ └──────────┘ └──────┘ │
│ Alerts │                                                    │
│ Budgets│  ┌────────────────────────────────────────────────┐│
│ Forecast│ │          Cost Over Time (live chart)           ││
│ Reports│  │  ═══════════════════╗                          ││
│ Team   │  │                     ║ ← live cursor            ││
│ Settings│ └────────────────────────────────────────────────┘│
│        │                                                    │
│        │  ┌─────────────────────┐ ┌────────────────────────┐│
│        │  │ Cost by Agent       │ │ Cost by Provider       ││
│        │  │ ████████ agent-1    │ │ ████████ OpenAI 67%    ││
│        │  │ ████ agent-2        │ │ ███ Anthropic 28%      ││
│        │  │ ██ agent-3          │ │ █ Google 5%            ││
│        │  └─────────────────────┘ └────────────────────────┘│
│        │                                                    │
│        │  ┌────────────────────────────────────────────────┐│
│        │  │ Recent Events (live feed)                      ││
│        │  │ 14:23:01  agent-1  gpt-4o     $0.034  ✓       ││
│        │  │ 14:22:58  agent-2  claude-s4  $0.021  ✓       ││
│        │  │ 14:22:45  agent-1  gpt-4o     $0.028  ✓       ││
│        │  │ ← new events slide in from top                 ││
│        │  └────────────────────────────────────────────────┘│
└────────┴────────────────────────────────────────────────────┘
```

### Comportement temps réel
- La connexion WebSocket s'établit au chargement du dashboard layout
- Chaque nouvel event apparaît dans le live feed avec une animation slide-in
- Les graphiques se mettent à jour en temps réel (pas de refresh)
- Les KPI cards (Today, This Month) s'incrémentent à chaque event
- Le projected EOM se recalcule côté client à chaque event (approximation rapide), le recalcul précis est fait par Celery toutes les heures
- Si la connexion WebSocket tombe → fallback polling toutes les 5s → reconnexion auto avec exponential backoff

### Filtres disponibles
- Date range : Today, Last 7 days, Last 30 days, Custom range
- Agent : dropdown multi-select
- Provider : dropdown multi-select
- Model : dropdown multi-select
- Team : dropdown (Team plan uniquement)

### Règles métier
- Le dashboard charge les données initiales via REST API puis switche en mode WebSocket pour les updates
- Les graphiques affichent max 1000 points de données. Au-delà → agrégation automatique
- Le live feed affiche les 50 derniers events. Scroll infini pour l'historique
- Mobile : le layout passe en single column, les graphiques sont stackés

---

## 3. TRACKING (POST /v1/track)

### User story
En tant que dev, je veux tracker chaque appel API IA avec un minimum d'effort, pour avoir une visibilité granulaire sur mes coûts.

### Payload SDK

```python
@track(
    agent="my-agent",           # Requis — nom de l'agent
    workflow="customer-support", # Optionnel — catégorie de workflow
    session_id="ticket-123",    # Optionnel — grouper en session
    user_label="user_456",      # Optionnel — attribuer à un end-user
    team_label="backend-team",  # Optionnel — attribuer à une équipe
    metadata={"version": "2.1"} # Optionnel — données custom
)
def call_openai(prompt):
    response = openai.chat.completions.create(...)
    return response
```

### Payload API directe

```json
{
    "agent": "my-agent",
    "model": "gpt-4o",
    "provider": "openai",
    "input_tokens": 1250,
    "output_tokens": 340,
    "cost_usd": 0.0234,
    "session_id": "ticket-123",
    "workflow": "customer-support",
    "user_label": "user_456",
    "team_label": "backend-team",
    "metadata": {"version": "2.1"}
}
```

### Calcul automatique du coût
- Si `cost_usd` est fourni → on l'utilise tel quel
- Si `cost_usd` n'est pas fourni mais `model` + `input_tokens` + `output_tokens` sont fournis → calcul automatique via la pricing table
- Si le modèle est inconnu → retourner l'event avec `cost_usd: null` et un warning dans la réponse
- La pricing table est cachée dans Redis (TTL 1h) et mise à jour par un Celery beat task quotidien

### Auto-création de l'agent
- Si le `agent` name n'existe pas pour cette org → créer automatiquement
- Pas d'erreur, pas de friction — le dev n'a pas besoin de pré-créer ses agents
- Vérifier la limite d'agents du plan avant auto-création (Free = 1, Starter = 5, Pro/Team = illimité)
- Si la limite est atteinte → retourner 403 avec un message clair : "Agent limit reached. Upgrade your plan to add more agents."

### Réponse

```json
{
    "event_id": "uuid",
    "agent": "my-agent",
    "cost_usd": 0.0234,
    "budget_remaining_usd": 47.23,
    "budget_status": "ok",
    "warnings": []
}
```

### Règles métier
- `agent` est le seul champ strictement requis
- Si `provider` n'est pas fourni, il est déduit du `model` name (gpt-* → openai, claude-* → anthropic, gemini-* → google)
- `session_id` est un string libre défini par le dev — on ne le génère jamais côté serveur
- `metadata` est limité à 10 clés, chaque valeur max 500 caractères
- Les events sont immutables — pas de PUT, pas de DELETE sur un event
- Les events avec `tracked_at` dans le futur sont rejetés (400)
- L'event est inséré même si le budget cap est en mode `alert_only`

### Edge cases
- Rate limit atteint → 429 avec header Retry-After
- Budget cap freeze → 429 avec body `{"error": "budget_exceeded", "agent": "my-agent", "budget_max_usd": 50.0}`
- Plan limit requêtes atteint → 429 avec body `{"error": "plan_limit_reached", "current": 100000, "max": 100000}`
- API key invalide ou révoquée → 401
- Payload invalide → 422 avec détail des erreurs de validation

---

## 4. AGENTS (CRUD)

### User story
En tant que dev, je veux voir la liste de mes agents, leur coût, et pouvoir les gérer, pour comprendre ce que chaque agent me coûte.

### Liste des agents (/dashboard/agents)

```
┌────────────────────────────────────────────────────────────────┐
│ Agent            │ Status │ Today   │ This Month │ Trend      │
├──────────────────┼────────┼─────────┼────────────┼────────────┤
│ support-agent    │ 🟢     │ $4.23   │ $127.50    │ +12% ▲     │
│ classifier       │ 🟢     │ $1.87   │ $45.30     │ -5% ▼      │
│ summarizer       │ 🟡     │ $8.91   │ $312.00    │ +89% ⚠️ ▲  │
│ data-extractor   │ 🔴     │ $0.00   │ $23.10     │ frozen     │
└────────────────────────────────────────────────────────────────┘
```

### Statuts agent
- 🟢 Active : événements dans les 24 dernières heures
- 🟡 Warning : anomalie détectée OU budget > 80%
- 🔴 Frozen : budget cap atteint, auto-freeze activé
- ⚫ Inactive : aucun événement depuis 7 jours

### Détail agent (/dashboard/agents/[id])
- Graphique coût over time (filtrable par période)
- Répartition par modèle (quel modèle cet agent utilise)
- Répartition par session/workflow
- KPI : coût moyen par requête, requêtes/jour, tokens/requête
- Forecast : coût projeté de cet agent en fin de mois
- Recommendations : suggestions d'optimisation spécifiques à cet agent
- Budget cap : jauge visuelle si un cap est configuré
- Derniers events : feed des 100 derniers events de cet agent

### Règles métier
- Un agent est auto-créé au premier event. Il peut ensuite être renommé ou désactivé dans le dashboard
- Désactiver un agent ne supprime PAS les events historiques — il n'apparaît plus dans les dropdowns mais ses données restent
- Un agent ne peut PAS être supprimé (soft delete uniquement via is_active = false)
- Le nom de l'agent est unique par organization (case-insensitive)
- Le trend est calculé en comparant la semaine en cours vs la semaine précédente

---

## 5. SESSION / WORKFLOW COSTING

### User story
En tant que dev, je veux connaître le coût total d'un workflow complet (ex: un ticket de support de bout en bout), pour comprendre la rentabilité de mes features IA.

### Vue sessions (/dashboard/sessions)

```
┌──────────────────────────────────────────────────────────────┐
│ Session ID       │ Agents │ Events │ Total Cost │ Duration   │
├──────────────────┼────────┼────────┼────────────┼────────────┤
│ ticket-123       │ 3      │ 12     │ $0.47      │ 4m 23s     │
│ ticket-124       │ 2      │ 8      │ $0.31      │ 2m 11s     │
│ analysis-batch-7 │ 1      │ 340    │ $12.87     │ 1h 12m     │
└──────────────────────────────────────────────────────────────┘
```

### Détail session
- Timeline visuelle des events dans la session (quels agents, dans quel ordre)
- Coût cumulé au fil du temps de la session
- Breakdown par agent dans la session
- Breakdown par modèle dans la session

### Agrégation par workflow
- Quand le champ `workflow` est utilisé, une vue agrégée est disponible :
  - "customer-support" : 234 sessions, coût moyen $0.42, coût total $98.28
  - "data-extraction" : 12 sessions, coût moyen $15.30, coût total $183.60
- Permet de comparer la rentabilité entre workflows

### Règles métier
- Le `session_id` est défini par le dev côté SDK/API — on ne le génère jamais
- Une session est "fermée" quand aucun event n'arrive pendant 30 minutes
- La durée = temps entre le premier et le dernier event de la session
- Les sessions sans `session_id` ne sont pas affichées dans cette vue (elles restent dans le feed events)
- Plan requis : Pro+ pour la vue sessions, Free/Starter voient le session_id dans les events mais pas la vue agrégée

---

## 6. ALERTES

### User story
En tant que dev, je veux être alerté quand mes coûts dépassent un seuil, pour réagir avant que la facture explose.

### Types d'alertes

| Type | Description | Threshold | Plan minimum |
|------|-------------|-----------|--------------|
| cost_daily | Coût journalier dépasse X$ | Défini par user | Starter |
| cost_weekly | Coût hebdomadaire dépasse X$ | Défini par user | Starter |
| cost_monthly | Coût mensuel dépasse X$ | Défini par user | Starter |
| requests_daily | Nombre de requêtes/jour dépasse X | Défini par user | Starter |
| requests_hourly | Nombre de requêtes/heure dépasse X | Défini par user | Starter |
| anomaly | Spike détecté automatiquement | Automatique (3σ) | Starter |

### Configuration (/dashboard/alerts)
- Formulaire : choisir le type, l'agent (ou tous), le seuil, le canal (email, Slack, both, webhook)
- Pour Slack : entrer le webhook URL ou se connecter via Slack OAuth
- Cooldown configurable : 15min, 30min, 1h, 4h, 24h (éviter le spam)
- Toggle on/off par alerte

### Format des notifications

**Email (Brevo) :**
```
Subject: ⚠️ AgentCostGuard — Daily cost alert for "support-agent"

Your agent "support-agent" has exceeded your daily cost threshold.

Current: $23.47
Threshold: $20.00
Overage: $3.47 (+17.4%)

→ View in dashboard: https://app.agentcostguard.io/dashboard/agents/uuid
```

**Slack :**
```
⚠️ *Cost Alert* — support-agent
Current: *$23.47* | Threshold: $20.00 | Overage: +$3.47 (+17.4%)
<https://app.agentcostguard.io/dashboard/agents/uuid|View in dashboard>
```

### Règles métier
- Les alertes anomaly (type `anomaly`) sont créées automatiquement pour chaque agent dès le plan Starter — pas de configuration nécessaire
- Le cooldown empêche de renvoyer la même alerte pendant la durée configurée
- Si une alerte est triggered et que la valeur redescend sous le seuil, le cooldown se reset
- Max 20 alert rules par org (Free: 0, Starter: 5, Pro: 20, Team: 20)
- L'historique des alertes est conservé pendant la durée d'historique du plan (7j / 30j / 90j / 1an)

---

## 7. ANOMALY DETECTION

### User story
En tant que dev, je veux être alerté automatiquement quand un agent a un comportement anormal, sans avoir à configurer des seuils manuellement.

### Fonctionnement

```
Phase d'apprentissage (7 premiers jours) :
    → Collecter les données horaires par agent
    → Calculer mean + stddev par (agent, heure du jour, jour de la semaine)
    → Pas d'alerte pendant cette phase

Phase active (après 7 jours) :
    → À chaque event, comparer le volume horaire actuel à la baseline
    → z-score = (valeur_actuelle - mean) / stddev
    → Si z > 3 → ANOMALIE (spike)
    → Si z < -2 → ANOMALIE (drop soudain — agent potentiellement cassé)
```

### Notification anomalie

```
🔴 *Anomaly Detected* — support-agent
Requests this hour: *847* (normal: ~120 ±35)
Cost this hour: *$34.21* (normal: ~$4.80)
This is *7.2x* above normal for Tuesday 2PM.

Possible causes:
• Agent looping on an edge case
• Unexpected traffic spike
• Prompt change causing longer outputs

→ View in dashboard
```

### Dashboard : anomaly timeline
- Timeline qui montre les spikes détectés sur les 30 derniers jours
- Chaque anomalie est cliquable → détail de l'heure avec les events
- Code couleur : rouge = spike coût, orange = spike volume, bleu = drop

### Règles métier
- L'anomaly detection est automatique pour tous les agents dès le plan Starter
- Pas de configuration requise — ça marche out of the box
- La baseline se met à jour en continu (exponential moving average, α = 0.1)
- Un agent avec moins de 100 events total n'a pas encore de baseline fiable → pas d'alerte anomaly
- Les anomalies sont différenciées des alertes manuelles dans l'historique
- Le z-score threshold est fixe (3σ pour spike, -2σ pour drop) — pas configurable par l'utilisateur pour garder la simplicité

---

## 8. COST FORECAST

### User story
En tant que dev ou PM, je veux voir la projection de mes coûts de fin de mois, pour anticiper ma facture et ajuster si nécessaire.

### Vue forecast (/dashboard/forecast)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Projected End-of-Month Cost                                 │
│                                                              │
│  ████████████████████████████░░░░░░░░░░  $847                │
│  ├── Current: $284 ──────────┤           ± $127              │
│  │                           │           (confidence range)  │
│                              │                               │
│  11 days elapsed             19 days remaining               │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Forecast chart                                          │ │
│  │ ═══════════════╗                                        │ │
│  │ actual data    ║  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ projected          │ │
│  │                ║ ╱                  ╲ confidence zone    │ │
│  │                ╚╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌                  │ │
│  │ Mar 1                              Mar 31               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Breakdown by agent:                                         │
│  support-agent    $340 projected  (40% of total)             │
│  summarizer       $290 projected  (34% of total)  ⚠️ +89%   │
│  classifier       $130 projected  (15% of total)             │
│  others           $87  projected  (11% of total)             │
└──────────────────────────────────────────────────────────────┘
```

### Forecast banner (affiché sur le dashboard principal)
- Toujours visible en haut : "Projected: $847 by end of month"
- Code couleur : vert (sous budget), orange (>80% budget), rouge (>100% budget)
- Clickable → va vers /dashboard/forecast

### Calcul
- Méthode : linear regression sur les coûts daily du mois en cours
- Minimum 3 jours de données pour afficher une projection
- Intervalle de confiance : ±15% (ajusté par la variance observée)
- Recalculé par Celery toutes les heures
- Affinement : pondération plus forte sur les 7 derniers jours (trend récent)

### Règles métier
- Disponible dès le plan Starter
- Si le mois vient de commencer (< 3 jours) → afficher "Not enough data yet" au lieu d'une projection peu fiable
- La projection par agent est calculée indépendamment pour chaque agent
- Si un agent est frozen (budget cap), son forecast reste au niveau actuel (il ne va plus dépenser)
- Le forecast tient compte des weekends si le pattern historique montre moins d'activité le weekend

---

## 9. BUDGET CAPS

### User story
En tant que dev, je veux définir un budget maximum par agent, pour être protégé automatiquement contre les dépassements.

### Configuration (/dashboard/budgets)

```
┌──────────────────────────────────────────────────────────────┐
│ Agent            │ Budget    │ Period  │ Usage     │ Action   │
├──────────────────┼───────────┼─────────┼───────────┼──────────┤
│ support-agent    │ $50/month │ Monthly │ ████░ 76% │ Freeze   │
│ summarizer       │ $20/day   │ Daily   │ ██░░ 45%  │ Freeze   │
│ classifier       │ $100/week │ Weekly  │ █░░░ 23%  │ Alert    │
│ [All agents]     │ $500/month│ Monthly │ ███░ 57%  │ Freeze   │
└──────────────────────────────────────────────────────────────┘
```

### Actions quand le budget est atteint

**Mode Freeze (défaut) :**
- Le SDK reçoit une réponse 429 `BudgetExceededError`
- L'agent passe en statut 🔴 Frozen sur le dashboard
- Une notification est envoyée (email + Slack)
- Un event WebSocket `budget_frozen` est publié
- Les appels sont bloqués jusqu'à : reset du period OU augmentation manuelle du budget

**Mode Alert Only :**
- L'event est quand même enregistré (pas de blocage)
- Une notification est envoyée
- L'agent passe en statut 🟡 Warning
- Le dashboard affiche un banner d'avertissement

### SDK behavior

```python
from agentcostguard import track, set_budget, BudgetExceededError

set_budget(agent="my-agent", max_usd=50.0, period="monthly")

@track(agent="my-agent")
def call_openai(prompt):
    response = openai.chat.completions.create(...)
    return response

# Le dev peut catcher l'erreur
try:
    call_openai("Hello")
except BudgetExceededError as e:
    print(f"Budget exceeded: {e.current_usd}/{e.max_usd}")
    # Fallback logic : utiliser un modèle moins cher, queue pour plus tard, etc.
```

### Jauge visuelle (BudgetGauge component)
- 0-60% : barre verte
- 60-80% : barre orange
- 80-100% : barre rouge
- 100%+ : barre rouge clignotante + icône freeze si mode freeze

### Règles métier
- Plan requis : Pro+ (Free et Starter n'ont pas les budget caps)
- Un budget cap peut être par agent OU global (tous les agents de l'org)
- Les périodes sont : daily (reset à minuit UTC), weekly (reset lundi minuit UTC), monthly (reset le 1er minuit UTC)
- Le counter est dans Redis (atomique) et synchronisé avec la DB toutes les 5 minutes
- Si Redis est down → le budget check est skippé (fail open, pas fail close — on ne bloque jamais le business du client à cause de notre infra)
- Max 50 budget caps par org
- Un agent peut avoir un cap daily ET un cap monthly (les deux sont vérifiés)

---

## 10. MODEL RECOMMENDATIONS

### User story
En tant que dev, je veux savoir si je peux utiliser un modèle moins cher sans sacrifier la qualité, pour réduire mes coûts automatiquement.

### Génération des recommandations

```
Celery task (hebdomadaire par org) :
    │
    ├── 1. Analyser les events des 7 derniers jours
    │
    ├── 2. Pour chaque agent, identifier :
    │      → Le modèle le plus utilisé
    │      → Le coût moyen par requête
    │      → Le nombre moyen de tokens (input + output)
    │
    ├── 3. Appel Claude API avec le contexte :
    │      "Agent 'support-agent' uses gpt-4o for 89% of calls.
    │       Average input: 450 tokens, average output: 120 tokens.
    │       Cost: $0.034/call, $127.50/month.
    │       Suggest cheaper alternatives with estimated savings."
    │
    ├── 4. Parser la réponse structurée
    │
    └── 5. Stocker les recommandations (cache Redis 7j)
```

### Affichage (RecommendationCard)

```
┌──────────────────────────────────────────────────────────────┐
│ 💡 Recommendation for support-agent                          │
│                                                              │
│ Switch from gpt-4o to gpt-4o-mini for simple classification │
│ calls (68% of your requests).                                │
│                                                              │
│ Estimated savings: $85/month (-67%)                          │
│                                                              │
│ Current: gpt-4o → $0.034/call                                │
│ Suggested: gpt-4o-mini → $0.011/call                         │
│                                                              │
│ [Dismiss]  [Learn more]                                      │
└──────────────────────────────────────────────────────────────┘
```

### Règles métier
- Plan requis : Pro+
- Généré automatiquement une fois par semaine par Celery
- Max 3 recommandations actives par agent
- Le dev peut "Dismiss" une recommandation (elle ne réapparaît pas pour cet agent/modèle combo)
- Les recommandations ne touchent JAMAIS au code du dev — c'est informatif uniquement
- On ne recommande jamais un modèle d'un provider différent (on reste dans le même provider pour éviter les changements de code)
- Si un agent a moins de 50 events dans la semaine → pas de recommandation (pas assez de données)

---

## 11. WEBHOOKS SORTANTS

### User story
En tant que dev, je veux recevoir des événements AgentCostGuard dans mes propres outils (Zapier, custom backend, etc.), pour automatiser mes workflows.

### Configuration (/dashboard/settings → Webhooks)
- Ajouter une URL endpoint
- Sélectionner les événements à recevoir :
  - `event.tracked` — chaque event tracké
  - `alert.fired` — alerte déclenchée
  - `anomaly.detected` — anomalie détectée
  - `budget.warning` — budget > 80%
  - `budget.exceeded` — budget cap atteint
  - `agent.frozen` — agent auto-freeze
- Un secret est auto-généré pour signer les payloads (HMAC SHA-256)

### Payload webhook

```json
{
    "id": "wh_uuid",
    "type": "alert.fired",
    "created_at": "2026-03-15T14:23:01Z",
    "data": {
        "alert_rule_id": "uuid",
        "agent": "support-agent",
        "metric": "cost_daily",
        "current_value": 23.47,
        "threshold": 20.00
    }
}
```

### Header de signature
```
X-ACG-Signature: sha256=abc123...
X-ACG-Timestamp: 1711234567
```

### Retry logic
- Tentative 1 : immédiat
- Tentative 2 : après 1 minute
- Tentative 3 : après 5 minutes
- Tentative 4 : après 30 minutes
- Tentative 5 : après 2 heures
- Après 5 échecs → webhook marqué comme failed, notification email au user

### Règles métier
- Plan requis : Pro+
- Max 5 webhook endpoints par org
- Timeout par requête : 10 secondes
- Les webhooks `event.tracked` sont batchés (max 1 envoi/10 secondes pour éviter le flood)
- Le dashboard affiche l'historique des livraisons avec le status code
- Le dev peut tester un webhook avec un "Send test" button

---

## 12. TEAM COST ATTRIBUTION

### User story
En tant que CTO, je veux voir combien chaque équipe dépense en IA, pour allouer les budgets et justifier les coûts auprès des investisseurs.

### Vue team (/dashboard/team)

```
┌──────────────────────────────────────────────────────────────┐
│ Team Attribution — March 2026                                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Pie chart : cost by team                                │ │
│  │  Backend 45% | ML Team 32% | Product 18% | Other 5%    │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────┬──────────┬──────────┬──────────┬──────────────┐ │
│ │ Team     │ Members  │ Agents   │ Cost MTD │ vs Last Month│ │
│ ├──────────┼──────────┼──────────┼──────────┼──────────────┤ │
│ │ Backend  │ 4        │ 5        │ $128.30  │ +12% ▲       │ │
│ │ ML Team  │ 3        │ 8        │ $91.20   │ -8% ▼        │ │
│ │ Product  │ 2        │ 2        │ $51.40   │ +45% ▲ ⚠️    │ │
│ │ Other    │ 1        │ 1        │ $14.10   │ —            │ │
│ └──────────┴──────────┴──────────┴──────────┴──────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Comment attribuer un coût à une team
- Via le `team_label` dans l'event (SDK ou API)
- Via le `team_label` sur le user (tous ses events héritent)
- Via l'agent : un agent peut être assigné à une team dans le dashboard
- Priorité : event.team_label > user.team_label > agent.team (fallback)

### Règles métier
- Plan requis : Team
- Les team labels sont des strings libres, pas un système rigide
- Le dashboard agrège par team_label
- Si aucun team_label → catégorie "Unassigned"
- Export CSV disponible pour le reporting financier

---

## 13. AUDIT LOG

### User story
En tant qu'admin d'une équipe, je veux savoir qui a fait quoi sur AgentCostGuard, pour la traçabilité et la sécurité.

### Vue audit (/dashboard/audit)

```
┌──────────────────────────────────────────────────────────────┐
│ Audit Log                                    [Filter] [Export]│
│                                                              │
│ Mar 15, 14:23  alice@team.com   Created alert rule           │
│                                 "daily-cost-alert" on agent  │
│                                 support-agent                │
│                                                              │
│ Mar 15, 11:02  bob@team.com     Revoked API key              │
│                                 "production-key" (acg_live_  │
│                                 xk4f)                        │
│                                                              │
│ Mar 14, 18:45  alice@team.com   Changed plan from Pro to     │
│                                 Team                         │
│                                                              │
│ Mar 14, 16:30  bob@team.com     Updated budget cap on        │
│                                 summarizer: $20/day → $35/day│
└──────────────────────────────────────────────────────────────┘
```

### Actions loggées
- API key created / revoked
- Alert rule created / updated / deleted
- Budget cap created / updated / deleted
- Agent renamed / deactivated
- Webhook endpoint created / updated / deleted
- Plan changed (upgrade / downgrade)
- Team member invited / removed / role changed
- Settings updated (Slack connection, email preferences)

### Règles métier
- Plan requis : Team
- L'audit log est immutable — pas de suppression
- Rétention : 1 an (même durée que l'historique Team)
- Chaque entrée inclut : user, action, resource, timestamp, IP address
- Filtrable par user, action type, date range
- Exportable en CSV

---

## 14. SLACK BOT INTERACTIF

### User story
En tant que dev, je veux consulter mes coûts IA directement dans Slack, sans ouvrir le dashboard, pour rester dans mon workflow.

### Slash commands

```
/costguard status
→ Résumé : Today $12.47 | Month $284.30 | Projected $847
→ Top 3 agents par coût today
→ Alertes actives

/costguard agent support-agent
→ Coût today, this week, this month
→ Trend vs semaine dernière
→ Budget cap status si configuré
→ Dernière anomalie si détectée

/costguard forecast
→ Projected EOM : $847 (±$127)
→ Top agent contributor
→ Lien vers le dashboard forecast

/costguard help
→ Liste des commandes disponibles
```

### Installation
- Slack OAuth flow depuis /dashboard/settings → Integrations → Slack
- Permissions requises : commands, chat:write, incoming-webhook
- Le bot s'installe dans le workspace Slack de l'utilisateur
- Un channel par défaut est configuré pour les alertes

### Format des réponses Slack
- Block Kit pour un rendu riche (pas du texte brut)
- Boutons interactifs : "View in dashboard", "Mute alert"
- Les réponses aux slash commands sont ephemeral (seul l'utilisateur qui tape la commande voit la réponse)

### Règles métier
- Plan requis : Team pour le bot interactif (slash commands)
- Les alertes simples via webhook Slack restent disponibles dès Starter
- Max 1 workspace Slack par organization
- Le bot ne peut PAS modifier des settings (read-only) — sécurité
- Rate limit : 1 slash command par user par 10 secondes

---

## 15. RAPPORTS PDF

### User story
En tant que CTO ou PM, je veux générer un rapport PDF professionnel de mes coûts IA, pour le partager avec mon équipe ou mes investisseurs.

### Contenu du rapport
- Page de garde : logo AgentCostGuard + nom de l'org + période
- Executive summary : coût total, nb agents, nb requêtes, trend
- Graphique : coût over time sur la période
- Table : coût par agent (top 10)
- Table : coût par provider/modèle
- Table : coût par team (si Team plan)
- Anomalies détectées pendant la période
- Recommandations actives
- Footer : "Generated by AgentCostGuard — agentcostguard.io"

### Génération
- Depuis /dashboard/reports : choisir la période (last 7 days, last 30 days, this month, custom)
- La génération est async (Celery task) — le user voit "Generating your report..."
- Quand prêt → notification + lien de téléchargement
- Le PDF est stocké temporairement (7 jours) puis supprimé

### Règles métier
- Plan requis : Team
- Max 10 rapports générés par mois
- La génération prend max 30 secondes
- Le PDF inclut le branding AgentCostGuard (watermark sur plan Free si jamais on ouvre cette feature)
- Pas de données sensibles dans le PDF (pas de clés API, pas de prompts)

---

## 16. DASHBOARD PERSONNALISABLE

### User story
En tant que power user, je veux organiser mon dashboard selon mes priorités, pour voir en premier ce qui compte pour moi.

### Fonctionnement
- Grid de widgets drag-and-drop
- Widgets disponibles : KPI cards, Cost Over Time, Cost by Agent, Cost by Provider, Cost by Model, Forecast chart, Anomaly timeline, Budget gauges, Recent events feed, Session costs, Team attribution
- L'utilisateur peut : ajouter/supprimer des widgets, les redimensionner, les réordonner
- La configuration est sauvegardée par user (pas par org)

### Règles métier
- Plan requis : Team
- La config par défaut est le dashboard standard (même pour Team)
- Max 12 widgets sur le dashboard
- Le layout est responsive : sur mobile, les widgets passent en single column dans l'ordre défini
- Reset to default disponible en un clic

---

## 17. BILLING & PLANS

### User story
En tant que client, je veux gérer mon abonnement simplement, upgrader/downgrader, et voir mes factures.

### Flow Stripe
- Signup → plan Free automatique (pas de Stripe customer créé)
- Upgrade → Stripe Checkout session → paiement → webhook → activation plan
- Downgrade → effectif à la fin de la période en cours
- Annulation → downgrade vers Free à la fin de la période

### Settings billing (/dashboard/settings → Billing)
- Plan actuel + usage (agents, requêtes ce mois)
- Bouton "Upgrade" / "Downgrade" / "Cancel"
- Lien vers le Stripe Portal pour gérer la carte et les factures
- Historique des factures (via Stripe Portal)

### Gestion des limites au downgrade
- Si l'utilisateur downgrade de Pro (agents illimités) à Starter (5 agents) et qu'il a 12 agents :
  - Les 12 agents restent mais seuls les 5 plus récents sont actifs
  - Les 7 autres passent en inactive
  - Un message explique : "7 agents have been deactivated. Reactivate them by upgrading."
- Les données historiques ne sont JAMAIS supprimées au downgrade
- L'historique est limité selon le plan (7j/30j/90j/1an) — les données au-delà ne sont plus visibles mais pas supprimées physiquement (cleanup par Celery après 30 jours de grâce)

### Webhooks Stripe à gérer
- `checkout.session.completed` → activer le plan
- `invoice.paid` → renouvellement OK
- `invoice.payment_failed` → notifier le user, grace period 7 jours
- `customer.subscription.updated` → upgrade/downgrade
- `customer.subscription.deleted` → retour au Free

### Règles métier
- Pas de trial — le plan Free remplace le trial
- Les prix sont en EUR (€)
- Paiement mensuel uniquement (pas d'annuel pour le moment)
- Pas de remboursement automatique — gestion manuelle si nécessaire
- Le plan est lié à l'organization, pas à l'utilisateur

---

## 18. API KEYS

### User story
En tant que dev, je veux créer et gérer mes clés API pour intégrer le SDK.

### Gestion (/dashboard/settings → API Keys)

```
┌──────────────────────────────────────────────────────────────┐
│ API Keys                                          [+ New Key]│
│                                                              │
│ Name           │ Prefix      │ Last used       │ Status      │
│ Default Key    │ acg_live_xk │ 2 minutes ago   │ 🟢 Active   │
│ Staging Key    │ acg_live_m3 │ 3 days ago      │ 🟢 Active   │
│ Old Key        │ acg_live_p9 │ Never           │ 🔴 Revoked  │
│                │             │                 │ [Revoke]    │
└──────────────────────────────────────────────────────────────┘
```

### Création d'une clé
- L'utilisateur donne un nom à la clé
- La clé complète est affichée UNE SEULE FOIS
- Format : `acg_live_` + 32 caractères aléatoires (base62)
- La clé est hashée (SHA-256) avant stockage en DB
- Seul le prefix (`acg_live_` + 4 premiers chars) est stocké en clair pour identification

### Règles métier
- Max 5 clés actives par org
- Une clé révoquée ne peut pas être réactivée
- La révocation est immédiate (le cache Redis est invalidé)
- Les clés n'ont pas d'expiration automatique (révocation manuelle uniquement)
- La création/révocation est loggée dans l'audit log (Team plan)

---

## 19. AUTHENTICATION

### User story
En tant que dev, je veux m'inscrire et me connecter simplement, avec mon email ou mon compte Google.

### Méthodes supportées
- Email + password (Supabase Auth)
- Google OAuth (Supabase Auth)

### Flow inscription
1. Choisir email ou Google
2. Si email : vérification par magic link (pas de mot de passe au signup — passwordless)
3. Création automatique de l'organization (slug = première partie de l'email)
4. Redirect vers l'onboarding

### Flow connexion
1. Email + magic link OU Google OAuth
2. Redirect vers /dashboard

### Invitations (Team plan)
- L'owner peut inviter des membres par email
- L'invité reçoit un email avec un lien d'invitation
- Au clic → signup/login → ajouté automatiquement à l'organization avec le rôle choisi
- Rôles : owner (1 seul), admin (peut tout faire sauf supprimer l'org), member (lecture + track)

### Règles métier
- L'email est unique dans tout le système
- Un user appartient à exactement 1 organization (pas de multi-org pour le moment)
- Le magic link expire après 1 heure
- 5 tentatives max par email par heure (anti-spam)
- La session JWT expire après 7 jours (refresh token automatique)

---

## 20. LANDING PAGE

### User story
En tant que visiteur, je veux comprendre ce que fait AgentCostGuard en 10 secondes, pour décider si ça vaut le coup de m'inscrire.

### Structure

```
[Nav] Logo — Features — Pricing — Docs — [Login] [Get Started Free]

[Hero]
Headline: "Stop overpaying for AI."
Subheadline: "Track, alert, and optimize your AI API costs in real-time.
              Setup in 2 minutes. No proxy. No BS."
CTA: [Start Free — No credit card]
Visual: Dashboard screenshot (dark mode, live data)

[Social proof]
"Used by X developers tracking $Y in AI spending"

[Features section — 6 cards]
1. Real-time tracking — See every dollar as it's spent
2. Smart alerts — Get notified before budgets blow up
3. Anomaly detection — AI watches your AI spending
4. Cost forecast — Know your bill before it arrives
5. Budget protection — Auto-freeze when limits hit
6. Model recommendations — Save money automatically

[How it works — 3 steps]
1. Install the SDK (code snippet)
2. Track your first call (code snippet)
3. See your costs live (dashboard screenshot)

[Pricing table]
Free / Starter / Pro / Team

[FAQ]
5-8 questions

[Final CTA]
"Your AI costs shouldn't be a surprise."
[Start Free — No credit card]

[Footer]
Links — Nova (@NovaShips) — Privacy — Terms
```

### Règles métier
- Dark mode uniquement (cohérent avec l'identité Nova)
- Couleur signature : violet #7C3AED
- Pas de stock photos — uniquement screenshots réels ou illustrations minimales
- Les code snippets sont copiables (bouton copy)
- La page doit se charger en < 2 secondes (Vercel Edge)
- Mobile-first responsive
- Plausible analytics sur les CTA (track: signup_click, pricing_click, docs_click)

---

> **Règle :** Ce fichier décrit ce que le produit FAIT.
> ARCH.md décrit COMMENT il le fait techniquement.
> Si une spec contredit CONTEXT.md → CONTEXT.md gagne.
> Si une spec contredit ARCH.md → discuter avant de trancher.
