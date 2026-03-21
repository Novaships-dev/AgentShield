# ANALYTICS.md — Events Tracking AgentShield

> Ce fichier définit TOUS les events analytics du produit : ce qu'on mesure, où, pourquoi, et comment. Claude Code le lit avant d'ajouter du tracking Plausible ou des métriques internes.
> Cohérent avec : INTEGRATIONS.md (Plausible), UI.md (pages), SPEC.md (features)
> Dernière mise à jour : mars 2026

---

## 1. STACK ANALYTICS

```
Plausible (privacy-first) — Comportement utilisateur sur le site
  → Pages vues, sources de trafic, events custom
  → Pas de cookies, GDPR-compliant

Métriques internes (Supabase) — Données produit
  → Signups, activations, conversions, churn
  → Stockées dans nos propres tables
```

**Règle : PAS de Google Analytics, PAS de trackers tiers invasifs.**

---

## 2. PLAUSIBLE — EVENTS CUSTOM

### Landing page

| Event | Trigger | Props |
|-------|---------|-------|
| `signup_click` | Clic sur CTA "Start Free" | `{source: "hero" \| "pricing" \| "final_cta" \| "nav"}` |
| `pricing_view` | Scroll jusqu'à la section pricing | — |
| `pricing_click` | Clic sur un plan | `{plan: "free" \| "starter" \| "pro" \| "team"}` |
| `demo_click` | Clic sur "Watch Demo" | — |
| `docs_click` | Clic vers la documentation | `{source: "nav" \| "hero" \| "footer"}` |
| `feature_click` | Clic sur une feature card | `{feature: "monitoring" \| "replay" \| "protect" \| ...}` |
| `module_click` | Clic sur un module card | `{module: "monitor" \| "replay" \| "protect"}` |

### Onboarding

| Event | Trigger | Props |
|-------|---------|-------|
| `onboarding_start` | User arrive au step 1 | — |
| `onboarding_step` | User passe à un step | `{step: 1\|2\|3\|4\|5}` |
| `onboarding_skip` | User clique "Skip" | `{at_step: number}` |
| `onboarding_complete` | User atteint le step 5 | `{duration_seconds: number}` |
| `first_event_tracked` | Premier event reçu (step 4 success) | `{time_to_first_event: number}` |

### Dashboard

| Event | Trigger | Props |
|-------|---------|-------|
| `dashboard_view` | Ouverture du dashboard | — |
| `agent_view` | Ouverture du détail agent | — |
| `session_view` | Ouverture d'une session Replay | — |
| `session_share` | Génération d'un share link | `{expires: "1h"\|"24h"\|"7d"\|"never"}` |
| `session_compare` | Ouverture de la comparaison | — |
| `alert_create` | Création d'une alert rule | `{metric: string, channel: string}` |
| `budget_create` | Création d'un budget cap | `{period: string, action: string}` |
| `guardrail_create` | Création d'une guardrail rule | `{type: string, action: string}` |
| `kill_switch_toggle` | Toggle du kill switch | `{enabled: boolean}` |
| `report_generate` | Demande de rapport PDF | — |
| `upgrade_click` | Clic sur "Upgrade" depuis le dashboard | `{from_plan: string, to_plan: string, source: string}` |
| `upgrade_complete` | Stripe checkout terminé | `{plan: string}` |
| `api_key_create` | Création d'une API key | — |
| `slack_connect` | Connexion Slack OAuth | — |
| `webhook_create` | Création d'un webhook endpoint | — |
| `pii_config_update` | Modification de la config PII | — |
| `invite_member` | Invitation d'un membre | `{role: string}` |

### Implémentation

```typescript
// lib/plausible.ts

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;
  }
}

export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (typeof window !== "undefined" && window.plausible) {
    window.plausible(event, { props });
  }
}

// Usage dans les composants
import { track } from "@/lib/plausible";

// Dans un onClick
onClick={() => {
  track("signup_click", { source: "hero" });
  router.push("/signup");
}}

// Dans un useEffect (page view)
useEffect(() => {
  track("dashboard_view");
}, []);
```

---

## 3. MÉTRIQUES INTERNES (Supabase)

### Table interne (pas exposée aux utilisateurs)

```sql
CREATE TABLE IF NOT EXISTS internal_metrics (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric      TEXT NOT NULL,
    value       DECIMAL(12, 4) NOT NULL,
    dimensions  JSONB DEFAULT '{}',
    measured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_metrics_type_time ON internal_metrics (metric, measured_at DESC);
```

### Métriques suivies

| Métrique | Fréquence | Source | Calcul |
|----------|-----------|--------|--------|
| `signups_daily` | Quotidien | auth.users count | Nouveaux users du jour |
| `activations_daily` | Quotidien | events table | Users ayant envoyé ≥ 1 event |
| `time_to_first_event` | Par user | events table | Temps entre signup et premier event |
| `conversion_free_to_paid` | Hebdo | organizations | % d'orgs Free → Starter/Pro/Team |
| `mrr` | Quotidien | Stripe API | Somme des abonnements actifs |
| `churn_monthly` | Mensuel | Stripe API | % d'annulations |
| `arpu` | Mensuel | Stripe API | MRR / nombre de clients payants |
| `dau` | Quotidien | events table | Users ayant envoyé ≥ 1 event aujourd'hui |
| `agents_per_org` | Hebdo | agents table | Moyenne d'agents par org |
| `events_per_day` | Quotidien | events table | Total events ingérés |
| `api_latency_p95` | Horaire | Sentry | P95 latence POST /v1/track |
| `error_rate` | Horaire | Sentry | % de requêtes 5xx |
| `replay_usage` | Quotidien | events | % d'events avec session_id |
| `protect_violations` | Quotidien | guardrail_violations | Nombre de violations/jour |
| `pii_detections` | Quotidien | events | Nombre de PII détectés/jour |

### Celery task pour les métriques

```python
# app/workers/tasks_maintenance.py

@shared_task(name="maintenance.compute_internal_metrics")
def compute_internal_metrics():
    """Compute daily internal metrics. Runs at 01:00 UTC via Beat."""
    today = date.today()
    yesterday = today - timedelta(days=1)

    # Signups
    signups = db.from_("users").select("id", count="exact").gte("created_at", yesterday).lt("created_at", today).execute()
    store_metric("signups_daily", signups.count)

    # Activations
    active_users = db.rpc("count_active_users", {"p_date": str(yesterday)}).execute()
    store_metric("activations_daily", active_users.data)

    # Events volume
    events = db.from_("events").select("id", count="exact").gte("tracked_at", yesterday).lt("tracked_at", today).execute()
    store_metric("events_per_day", events.count)

    # Replay usage
    events_with_session = db.from_("events").select("id", count="exact").gte("tracked_at", yesterday).lt("tracked_at", today).neq("session_id", None).execute()
    replay_pct = (events_with_session.count / max(events.count, 1)) * 100
    store_metric("replay_usage", replay_pct)

    # ... autres métriques
```

---

## 4. FUNNEL DE CONVERSION

### Funnel principal

```
Landing page visit
  ↓ (signup_click)
Signup
  ↓ (onboarding_start)
Onboarding Step 1
  ↓
Onboarding Step 2 (API key)
  ↓
Onboarding Step 3 (SDK install)
  ↓ (first_event_tracked)
First event tracked ← ACTIVATION
  ↓ (time passes, value realized)
  ↓ (upgrade_click)
Stripe Checkout
  ↓ (upgrade_complete)
Paid customer ← CONVERSION
```

### Métriques funnel

```
Visit → Signup           : taux de conversion landing
Signup → First event     : taux d'activation (cible > 60%)
Time to first event      : latence d'activation (cible < 10 min)
First event → Day 7 use  : rétention J7 (cible > 40%)
Free → Paid              : conversion (cible > 8%)
Paid → Month 2           : rétention M1 (cible > 95%, donc churn < 5%)
```

---

## 5. ALERTES INTERNES

### Alertes business (envoyées à Nova via Slack #metrics)

```
| Condition | Alerte | Seuil |
|-----------|--------|-------|
| Signups/jour = 0 depuis 48h | "⚠️ No signups in 48h" | 0 |
| Activation rate < 30% | "📉 Activation rate dropped to {pct}%" | 30% |
| Churn > 10% ce mois | "🔴 Monthly churn at {pct}%" | 10% |
| MRR drop > 10% WoW | "📉 MRR dropped {pct}% this week" | 10% |
| Error rate > 5% | "🔴 API error rate at {pct}%" | 5% |
| P95 latency > 200ms | "⚠️ POST /v1/track p95 at {ms}ms" | 200ms |
```

### Alertes positives

```
| Condition | Alerte |
|-----------|--------|
| 10ème signup | "🎉 10 signups reached!" |
| 100ème signup | "🎉 100 signups!" |
| Premier client payant | "💰 First paying customer! {plan} €{price}" |
| MRR > €500 | "🚀 MRR milestone: €500" |
| MRR > €1000 | "🚀 MRR milestone: €1000" |
| MRR > €2000 | "🚀 MRR milestone: €2000 — double down criteria met" |
```

---

## 6. TABLEAU DE BORD INTERNE

Pas un dashboard dans l'app — un dashboard privé pour Nova, construit avec les internal_metrics.

```
KPIs principaux :
  - MRR actuel (Stripe)
  - Clients payants (Stripe)
  - Signups cette semaine
  - Activation rate (%)
  - Events ingérés aujourd'hui
  - API latency p95

Graphiques :
  - MRR over time
  - Signups per day
  - Events per day
  - Funnel conversion rates
  - Churn rate monthly

Format : requête SQL directe dans Supabase Dashboard ou outil simple (Metabase self-hosted si nécessaire)
```

---

## 7. PRIVACY

```
CE QU'ON TRACK :
  ✅ Pages vues (Plausible, anonyme)
  ✅ Events custom (actions dans l'app, anonyme)
  ✅ Métriques produit agrégées (pas par user)
  ✅ MRR et signups (données business)

CE QU'ON NE TRACK PAS :
  ❌ Identité de l'utilisateur dans Plausible (anonyme)
  ❌ Contenu des prompts/réponses dans les analytics
  ❌ IP address dans les analytics
  ❌ Cookies tiers
  ❌ Fingerprinting
  ❌ Session recording (pas de Hotjar/FullStory)
  ❌ Comportement de scroll/mouse hors events explicites
```

---

> **Règle :** On mesure ce qui compte pour prendre des décisions, pas pour espionner les utilisateurs.
> Chaque event ajouté doit avoir un "pourquoi" clair : quelle décision est-ce que cette métrique informe ?
