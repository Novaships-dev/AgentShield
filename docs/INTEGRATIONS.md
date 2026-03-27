# INTEGRATIONS.md — Services tiers & API externes AgentShield

> Ce fichier documente TOUS les services tiers utilisés par AgentShield : leur rôle, leur configuration, leurs limites, et comment interagir avec eux. Claude Code le lit avant de toucher à une intégration externe.
> Cohérent avec : ENV.md (clés API), DEPLOY.md (infrastructure), WEBHOOKS.md (Stripe/Slack)
> Dernière mise à jour : mars 2026

---

## 1. CARTOGRAPHIE DES SERVICES

```
┌──────────────────────────────────────────────────────────────┐
│                     AGENTSHIELD                              │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ Supabase│  │  Redis  │  │ Stripe  │  │  Brevo  │       │
│  │ DB+Auth │  │ Cache   │  │ Billing │  │ Email   │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │  Slack  │  │ Claude  │  │ Sentry  │  │Plausible│       │
│  │Bot+Alert│  │   API   │  │Monitoring│  │Analytics│       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                              │
│  ┌─────────┐  ┌─────────┐                                   │
│  │Cloudflare│ │ Railway │                                   │
│  │ DNS+CDN │  │ Deploy  │                                   │
│  └─────────┘  └─────────┘                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. SUPABASE

### Rôle
Database PostgreSQL + Auth (email magic link + Google OAuth) + Row Level Security.

### Configuration

| Setting | Valeur |
|---------|--------|
| Project region | EU West (Paris) |
| Plan | Free → Pro quand > 500 users |
| Auth providers | Email (magic link), Google OAuth |
| RLS | Activé sur 19 tables |
| Realtime | Désactivé (on utilise notre propre WebSocket via Redis) |

### Librairie Python

```python
# app/utils/supabase.py

from supabase import create_client, Client

def get_supabase_client() -> Client:
    """Get Supabase client (service role for backend)."""
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,  # Service role = bypass RLS
    )

def get_supabase_anon_client() -> Client:
    """Get Supabase client (anon for user-scoped queries)."""
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
    )
```

### Limites Supabase Free

| Limite | Valeur | Impact |
|--------|--------|--------|
| DB size | 500 MB | Suffisant ~6 mois avec cleanup |
| Auth users | 50K MAU | Largement suffisant |
| API requests | 500K/mois | Surveiller via analytics |
| Edge functions | 500K invocations | Pas utilisé (on a notre backend) |
| Storage | 1 GB | Pas utilisé (on ne stocke pas de fichiers) |

### Quand upgrader
- DB size > 400 MB → Supabase Pro ($25/mois)
- Besoin de daily backups automatiques → Supabase Pro
- Besoin de plus de connexions simultanées → Supabase Pro

---

## 3. STRIPE

### Rôle
Paiements : checkout, abonnements, portail client, webhooks.

### Configuration

| Setting | Valeur |
|---------|--------|
| Mode | Test (dev/staging) → Live (prod) |
| Compte | Compte Nova dédié (séparé) |
| Produits | 1 produit "AgentShield" avec 4 prix |
| Webhooks | Endpoint configuré dans le dashboard Stripe |

### Products & Prices (à créer dans Stripe Dashboard)

```
Product : "AgentShield"
  Price "Free"    : €0/month   (pas de prix Stripe — géré côté app)
  Price "Starter" : €49/month  → price_id = STRIPE_PRICE_STARTER
  Price "Pro"     : €99/month  → price_id = STRIPE_PRICE_PRO
  Price "Team"    : €199/month → price_id = STRIPE_PRICE_TEAM
```

### Librairie Python

```python
# app/services/stripe.py

import stripe

stripe.api_key = settings.stripe_secret_key

async def create_checkout_session(org_id: str, plan: str, success_url: str, cancel_url: str) -> str:
    """Create a Stripe Checkout session."""
    price_map = {
        "starter": settings.stripe_price_starter,
        "pro": settings.stripe_price_pro,
        "team": settings.stripe_price_team,
    }

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_map[plan], "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"organization_id": org_id, "plan": plan},
        allow_promotion_codes=True,
    )
    return session.url

async def create_portal_session(customer_id: str, return_url: str) -> str:
    """Create a Stripe Customer Portal session."""
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return session.url
```

### Limites Stripe

| Limite | Valeur |
|--------|--------|
| Webhook timeout | 20 secondes |
| Webhook retry | 3 jours, backoff exponentiel |
| API rate limit | 100 req/s (mode live) |

---

## 4. CLAUDE API (Anthropic)

### Rôle
Smart Alerts (diagnostic IA des alertes) + Cost Autopilot (recommandations de modèle).

### Configuration

| Setting | Valeur |
|---------|--------|
| Modèle | claude-sonnet-4-6 |
| Max tokens | 1000 par réponse |
| Timeout | 30 secondes |
| Usage | Uniquement dans les Celery tasks (jamais sync dans un endpoint) |

### Client Python

```python
# app/services/claude.py

import anthropic

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

async def diagnose_alert(context: dict) -> dict:
    """Call Claude API to diagnose an alert."""
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=settings.anthropic_max_tokens,
        system="You are an AI cost optimization expert. Analyze the alert data and provide a concise diagnosis and actionable fix suggestion. Respond in JSON format with keys: diagnosis, suggested_fix, confidence (0-1).",
        messages=[{
            "role": "user",
            "content": f"Alert context:\n{json.dumps(context, indent=2)}\n\nDiagnose the probable cause and suggest a fix.",
        }],
    )
    return json.loads(response.content[0].text)

async def generate_recommendations(agent_data: dict) -> list[dict]:
    """Call Claude API to generate cost optimization recommendations."""
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=settings.anthropic_max_tokens,
        system="You are an AI cost optimization expert. Analyze the agent usage data and recommend cheaper model alternatives where appropriate. Respond in JSON array format with objects containing: current_model, suggested_model, reasoning, estimated_savings_pct.",
        messages=[{
            "role": "user",
            "content": f"Agent usage data (last 7 days):\n{json.dumps(agent_data, indent=2)}\n\nRecommend model optimizations.",
        }],
    )
    return json.loads(response.content[0].text)
```

### Coût estimé

```
Smart Alerts :
  - ~500 tokens input + ~300 tokens output par diagnostic
  - Coût : ~$0.006 par diagnostic
  - Si 100 alertes/mois → ~$0.60/mois

Cost Autopilot :
  - ~1000 tokens input + ~500 tokens output par agent
  - Coût : ~$0.011 par analyse
  - Si 50 agents analysés/semaine → ~$2.20/mois

Total estimé : < $5/mois pour 100 clients
```

### Limites

| Limite | Valeur |
|--------|--------|
| Rate limit | 4000 RPM (Tier 2) |
| Max tokens output | 8192 |
| Timeout | 30s (configurable) |

### Fallback si Claude API down
- Smart Alerts : la notification basique part sans diagnostic. Le diagnostic est ajouté en retry quand l'API revient.
- Cost Autopilot : les recommandations ne sont pas générées cette semaine. Pas de fallback — c'est une feature "nice to have".

---

## 5. BREVO (Email)

### Rôle
Emails transactionnels : alertes, onboarding, billing, invitations.

### Configuration

| Setting | Valeur |
|---------|--------|
| Plan | Free (300 emails/jour) → Starter quand > 50 clients |
| Sender | alerts@agentshield.one |
| Sender name | AgentShield |

### Templates email

| Template | Trigger | Contenu |
|----------|---------|---------|
| welcome | Signup | Bienvenue + lien vers onboarding |
| alert_fired | Alerte déclenchée | Détails de l'alerte + lien dashboard |
| smart_alert | Diagnostic IA prêt | Diagnostic + suggested fix + lien Replay |
| anomaly_detected | Anomalie détectée | Agent, valeur, baseline, lien dashboard |
| budget_warning | Budget > 80% | Agent, usage, cap, lien dashboard |
| budget_exceeded | Kill switch auto | Agent, usage, cap, instructions |
| payment_failed | Paiement Stripe échoué | Lien vers Stripe Portal pour mettre à jour |
| plan_activated | Plan payant activé | Confirmation + nouvelles features disponibles |
| plan_downgraded | Retour au Free | Ce qui change + lien pour upgrader |
| invite_member | Invitation Team | Lien d'invitation |
| report_ready | PDF prêt | Lien de téléchargement (valide 7 jours) |

### Client Python

```python
# app/services/brevo.py

import sib_api_v3_sdk

configuration = sib_api_v3_sdk.Configuration()
configuration.api_key["api-key"] = settings.brevo_api_key
api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

async def send_alert_email(to_email: str, alert: dict) -> None:
    """Send an alert notification email."""
    email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": to_email}],
        sender={"email": settings.brevo_sender_email, "name": settings.brevo_sender_name},
        subject=f"⚠️ AgentShield — {alert['type']} for '{alert['agent']}'",
        html_content=render_alert_template(alert),
    )
    api.send_transac_email(email)
```

### Limites Brevo Free

| Limite | Valeur | Impact |
|--------|--------|--------|
| Emails/jour | 300 | ~6 alertes/client si 50 clients |
| API rate | 400 req/min | Suffisant |
| Templates | Illimité | OK |

### Quand upgrader
- Plus de 50 clients actifs avec alertes → Brevo Starter ($25/mois, 20K emails/mois)

---

## 6. SLACK API

### Rôle
Deux usages distincts :
1. **Alertes simples** (Starter+) : incoming webhook URL configurée par le user
2. **Bot interactif** (Team) : slash commands /shield, OAuth, Block Kit

### Configuration Slack App

```
App Name: AgentShield
OAuth Scopes (Bot Token):
  - commands              (slash commands)
  - chat:write           (envoyer des messages)
  - incoming-webhook     (webhook URL pour les alertes)

Slash Commands:
  - /shield              → POST https://api.agentshield.one/v1/slack/commands

Event Subscriptions:
  - URL: https://api.agentshield.one/v1/slack/events

Interactivity:
  - Request URL: https://api.agentshield.one/v1/slack/interactions
```

### OAuth flow

```
1. User clique "Connect Slack" dans /dashboard/settings
2. Redirect vers : https://slack.com/oauth/v2/authorize?client_id=...&scope=commands,chat:write
3. User autorise → Slack redirige vers notre callback avec un code
4. Backend échange le code contre un access token
5. Stocke le token (chiffré) + team_id + channel_id en DB
6. Le bot est installé dans le workspace du user
```

### Limites Slack API

| Limite | Valeur |
|--------|--------|
| Message rate | 1 msg/s par channel |
| Slash command response | 3 secondes max (sinon ack + follow-up) |
| Block Kit | 50 blocks max par message |

---

## 7. SENTRY

### Rôle
Error tracking + performance monitoring backend et frontend.

### Configuration

```python
# Backend
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

sentry_sdk.init(
    dsn=settings.sentry_dsn,
    environment=settings.sentry_environment,
    traces_sample_rate=settings.sentry_traces_sample_rate,
    integrations=[
        FastApiIntegration(transaction_style="endpoint"),
        CeleryIntegration(),
    ],
    before_send=filter_sensitive_data,
)

def filter_sensitive_data(event, hint):
    """Remove sensitive data before sending to Sentry."""
    # Supprimer les API keys des breadcrumbs
    # Supprimer les input_text/output_text des events
    # Supprimer les headers Authorization
    return event
```

```typescript
// Frontend (next.config.js + sentry.client.config.ts)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Ce qu'on NE log PAS dans Sentry
- API keys (même partielles)
- Input/output text (contenu des prompts)
- Emails des utilisateurs dans les breadcrumbs
- Tokens JWT
- Données PII

---

## 8. PLAUSIBLE

### Rôle
Analytics privacy-first pour la landing page et l'app.

### Configuration

```
Site: agentshield.one
Plan: Free (géré) ou self-hosted
Script: <script defer data-domain="agentshield.one" src="https://plausible.io/js/script.js"></script>
```

### Events custom à tracker

| Event | Page | Quand |
|-------|------|-------|
| signup_click | Landing | Clic sur CTA "Start Free" |
| pricing_click | Landing | Clic sur un plan pricing |
| docs_click | Landing | Clic vers la documentation |
| onboarding_complete | Setup | Step 5 atteint |
| first_event_tracked | Setup | Premier event reçu |
| upgrade_click | Dashboard | Clic sur "Upgrade" |
| share_session | Dashboard | Génération d'un share link |

### Intégration Next.js

```typescript
// lib/plausible.ts

export function trackEvent(name: string, props?: Record<string, string>) {
  if (typeof window !== "undefined" && window.plausible) {
    window.plausible(name, { props });
  }
}

// Usage
trackEvent("signup_click", { source: "hero" });
trackEvent("upgrade_click", { from_plan: "free", to_plan: "starter" });
```

---

## 9. CLOUDFLARE

### Rôle
DNS, SSL/TLS, protection DDoS, caching basique.

### Configuration
Voir DEPLOY.md section 7 pour les records DNS.

### Settings importants

| Setting | Valeur | Pourquoi |
|---------|--------|----------|
| SSL mode | Full (strict) | Railway et Vercel ont leurs propres certs |
| Always HTTPS | On | Pas de HTTP en production |
| Min TLS | 1.2 | Sécurité standard |
| WAF | On (managed rules) | Protection basique |
| Bot fight mode | On | Anti-scraping |
| Caching | Respect origin headers | Laisser Next.js et FastAPI gérer le cache |

---

## 10. RAILWAY

### Rôle
Hébergement backend : FastAPI API, Celery Worker, Celery Beat, Redis.

### Configuration
Voir DEPLOY.md section 3 pour les détails.

### Limites Railway

| Plan | Limite | Impact |
|------|--------|--------|
| Hobby ($5/mois) | 8 GB RAM, 8 vCPU, 100 GB network | Suffisant au launch |
| Pro ($20/mois) | 32 GB RAM, 32 vCPU | Quand on scale |

---

## 11. VERCEL

### Rôle
Hébergement frontend : Next.js SSR + static, Edge Functions.

### Configuration
Voir DEPLOY.md section 4 pour les détails.

### Limites Vercel

| Plan | Limite | Impact |
|------|--------|--------|
| Hobby (gratuit) | 100 GB bandwidth, 100K serverless invocations | Suffisant au launch |
| Pro ($20/mois) | 1 TB bandwidth, 1M invocations | Quand > 1000 users |

---

## 12. RÉSUMÉ DES COÛTS D'INFRASTRUCTURE

### Au launch (0-50 clients)

| Service | Plan | Coût/mois |
|---------|------|-----------|
| Supabase | Free | $0 |
| Railway (4 services) | Hobby | $5 |
| Vercel | Hobby | $0 |
| Redis (Railway) | Inclus | $0 |
| Cloudflare | Free | $0 |
| Brevo | Free | $0 |
| Plausible | Free ou $9 | $0-9 |
| Sentry | Free (5K events) | $0 |
| Claude API | Pay-as-you-go | ~$5 |
| Stripe | 2.9% + €0.25/tx | ~$0-15 |
| Domaine | Porkbun | ~$1 |
| **Total** | | **~$11-35/mois** |

### Après traction (50-200 clients)

| Service | Plan | Coût/mois |
|---------|------|-----------|
| Supabase | Pro | $25 |
| Railway (4 services) | Pro | $20 |
| Vercel | Pro | $20 |
| Brevo | Starter | $25 |
| Claude API | | ~$15 |
| **Total** | | **~$120/mois** |

### Breakeven
- ARPU €70/mois
- Infra $120/mois ≈ €110/mois
- Breakeven ≈ 2 clients payants (en coûts infra uniquement)

---

## 13. CHECKLIST NOUVELLE INTÉGRATION

```
□ Le service est documenté dans ce fichier (INTEGRATIONS.md)
□ Les variables d'env sont ajoutées dans ENV.md
□ Les variables d'env sont dans .env.example
□ Le client est dans app/services/{service}.py
□ Les limites du service sont documentées
□ Le fallback si le service est down est défini
□ Les données sensibles ne sont pas loggées
□ Le coût est estimé et ajouté à la section 12
```

---

> **Règle :** Chaque service tiers est un point de défaillance potentiel. Pour chaque intégration, définir : que se passe-t-il si ce service est down pendant 1 heure ?
> AgentShield doit continuer à fonctionner en mode dégradé — jamais crash complet.
