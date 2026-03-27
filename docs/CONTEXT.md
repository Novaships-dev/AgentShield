# CONTEXT.md — AgentShield

> Source de vérité du projet. Chaque fichier du repo, chaque décision technique, chaque prompt Claude Code doit être cohérent avec ce document.
> Dernière mise à jour : mars 2026

---

## 1. EN UNE PHRASE

**"The complete observability suite for AI agents."**

AgentShield monitore les coûts, rejoue chaque session pas à pas, et protège les agents avec des guardrails configurables — le tout en une ligne de code.

Tool #1 de Nova (@NovaShips). Premier SaaS du portfolio.

---

## 2. LE PROBLÈME

Les équipes déploient des agents IA en production. Elles n'ont aucune visibilité.

**Douleur 1 — Coûts invisibles**

```
Semaine 1 : agent déployé. Tout fonctionne.
Semaine 2 : l'agent loop sur un edge case. 50 000 appels API.
Fin du mois : facture de $847. Surprise totale.
```

**Douleur 2 — Debugging impossible**

```
L'agent échoue sur 3% des sessions.
Personne ne sait à quelle étape.
Reproduire le bug : impossible sans les données de session.
```

**Douleur 3 — Zéro contrôle en production**

```
Un agent répond à des questions hors scope.
Un autre expose des données PII.
Un troisième dépasse le budget sans que personne ne s'en rende compte.
Kill switch inexistant.
```

**Ce que les équipes font aujourd'hui :**

- Dashboard du provider (OpenAI, Anthropic) → pas de détail par agent, pas de replay, pas de guardrails
- Logger manuellement → non scalable, réactif, pas temps réel
- Rien → la majorité — et ils subissent les conséquences

**Pourquoi maintenant :**

- Les agents IA passent du prototype à la production en masse en 2026
- Les coûts API explosent avec l'usage
- Les exigences compliance (PII, audit, logs) deviennent obligatoires dans les équipes 10+
- 70% des CIOs citent "AI cost unpredictability" comme frein principal à l'adoption
- Aucun outil standalone ne couvre les trois dimensions (Monitor + Replay + Protect)

---

## 3. LA SOLUTION

**AgentShield — 3 modules, 1 SDK, 1 ligne de code.**

### Module 1 — Monitor
- Track les coûts en temps réel par agent, par workflow, par user, par équipe, par jour
- Alertes Slack/email configurables par seuil
- Anomaly detection automatique (baseline glissante, spike detection)
- Cost forecast / projection fin de mois en temps réel
- Smart Alerts : diagnostic IA de la cause probable + suggestion de fix
- Cost Autopilot : recommandations automatiques de modèle avec économies chiffrées
- Rapports PDF pour les stakeholders

### Module 2 — Replay
- Timeline visuelle step-by-step de chaque session d'agent
- Voir chaque input, chaque output, chaque appel API dans l'ordre exact
- Filtrer par session ID, par agent, par date, par statut (succès/échec)
- Partager une session en URL pour le debug d'équipe
- Mesurer la durée et le coût de chaque step
- Identifier les steps qui coûtent le plus ou qui échouent le plus

### Module 3 — Protect
- Guardrails configurables (topics, mots-clés, catégories interdites)
- PII redaction automatique (emails, téléphones, cartes de crédit, SSN)
- Budget caps par agent avec kill switch automatique
- Compliance mode : logs immuables pour audit GDPR

### Killer features transversales
- **Smart Alerts** : quand une alerte se déclenche, l'IA diagnostique la cause probable et suggère un fix — pas juste une notification
- **Cost Autopilot** : analyse les patterns de coût et recommande automatiquement quel modèle utiliser par type de tâche
- **Setup 1 ligne de code** : pas de proxy, pas de redirection DNS, pas de réécriture d'architecture
- **UI/UX premium dark mode** : classe mondiale, pas un dashboard analytics de 2018
- **Framework-agnostic** : LangChain, CrewAI, AutoGen, LlamaIndex, custom — aucune importance
- **Compliance-ready** : logs immuables, exports GDPR, audit trail complet

**Ce qu'il ne fait PAS :**

- Il n'est PAS un proxy complet (pas Helicone)
- Il ne route PAS les requêtes (pas Portkey)
- Il ne fait PAS d'évaluation de modèles (pas Braintrust)

---

## 4. ICP — QUI ACHÈTE

### Persona primaire — L'équipe IA 3-30 personnes (60% des clients)

- Startup ou scale-up avec des agents en production
- 3-30 développeurs, dont au moins 1 responsable IA
- Budget IA non maîtrisé ou incidents de prod récents
- Besoin de reporting vers management ou investisseurs
- Pain : coûts non contrôlés + debugging long + pas de guardrails
- Willingness to pay : €99-199/mois
- Canal : Twitter, Product Hunt, LinkedIn, IndieHackers

### Persona secondaire — L'agence IA (30% des clients)

- Agence qui deploy des agents pour des clients
- Doit facturer les coûts IA et les justifier
- Gère 10-50 agents différents pour des clients différents
- Pain : impossible de répartir les coûts + pas de rapport + risque contractuel
- Willingness to pay : €199/mois (plan Team)
- Canal : Bouche à oreille, partnerships, LinkedIn

### Persona tertiaire — Dev solo / indie hacker (10% des clients, 40% des free users)

- Développeur seul ou équipe de 2-3
- Déploie 1-5 agents IA
- Pain : dépassements de fin de mois + pas de visibilité
- Willingness to pay : €0-49/mois
- Canal : Twitter, Reddit r/LocalLLaMA, IndieHackers
- Rôle stratégique : Free tier = acquisition, pas cible principale

---

## 5. PRICING

| Plan | Prix/mois | Agents | Modules inclus | Notes |
|------|-----------|--------|----------------|-------|
| Free | €0 | 1 | Monitor only | Acquisition |
| Starter | €49 | 5 | Monitor + Replay | Cible principale |
| Pro | €99 | Illimité | Monitor + Replay + Protect | Full suite |
| Team | €199 | Illimité | Tout + multi-user + compliance + PDF | Agences et équipes |

**ARPU cible :** €70/mois (mix Starter/Pro)
**Conversion free → paid cible :** 8%+
**Churn cible :** <5%/mois

---

## 6. FEATURES PAR MODULE ET PAR PLAN

### Module Monitor (Free+)

| Feature | Free | Starter | Pro | Team |
|---------|------|---------|-----|------|
| Dashboard temps réel (WebSocket) | ✅ | ✅ | ✅ | ✅ |
| Tracking par agent/workflow/provider/modèle | ✅ (1 agent) | ✅ (5) | ✅ (∞) | ✅ (∞) |
| Onboarding guidé interactif | ✅ | ✅ | ✅ | ✅ |
| Historique | 7 jours | 30 jours | 90 jours | 1 an |
| Alertes seuils (Slack + email) | ❌ | ✅ | ✅ | ✅ |
| Anomaly detection automatique | ❌ | ✅ | ✅ | ✅ |
| Cost forecast / projection EOM | ❌ | ✅ | ✅ | ✅ |
| Smart Alerts (diagnostic IA) | ❌ | ❌ | ✅ | ✅ |
| Cost Autopilot (recommandations modèle) | ❌ | ❌ | ✅ | ✅ |
| Session / workflow costing | ❌ | ❌ | ✅ | ✅ |
| Webhooks sortants | ❌ | ❌ | ✅ | ✅ |
| Rapports PDF | ❌ | ❌ | ❌ | ✅ |
| Team cost attribution | ❌ | ❌ | ❌ | ✅ |
| Audit log | ❌ | ❌ | ❌ | ✅ |
| Slack bot interactif | ❌ | ❌ | ❌ | ✅ |
| Dashboard personnalisable | ❌ | ❌ | ❌ | ✅ |

### Module Replay (Starter+)

| Feature | Free | Starter | Pro | Team |
|---------|------|---------|-----|------|
| Session timeline step-by-step | ❌ | ✅ | ✅ | ✅ |
| Inputs/outputs de chaque step | ❌ | ✅ | ✅ | ✅ |
| Filtre par session/agent/date/statut | ❌ | ✅ | ✅ | ✅ |
| Coût et durée par step | ❌ | ✅ | ✅ | ✅ |
| Partage de session par URL | ❌ | ❌ | ✅ | ✅ |
| Comparaison de sessions | ❌ | ❌ | ✅ | ✅ |
| Annotations et commentaires | ❌ | ❌ | ❌ | ✅ |

### Module Protect (Pro+)

| Feature | Free | Starter | Pro | Team |
|---------|------|---------|-----|------|
| Budget caps par agent + kill switch | ❌ | ❌ | ✅ | ✅ |
| Guardrails configurables (topics/keywords) | ❌ | ❌ | ✅ | ✅ |
| PII redaction automatique | ❌ | ❌ | ✅ | ✅ |
| Compliance mode (logs immuables) | ❌ | ❌ | ❌ | ✅ |
| Export GDPR | ❌ | ❌ | ❌ | ✅ |

---

## 7. STACK TECHNIQUE

| Layer | Technologie | Notes |
|-------|-------------|-------|
| Backend | FastAPI — Python 3.12+ | |
| Queue | Celery + Redis | Jobs async (alertes, replay, agrégation) |
| WebSocket | FastAPI WebSocket + Redis Pub/Sub | Dashboard temps réel |
| Frontend | Next.js 14 + TypeScript + Tailwind + shadcn/ui | Dark mode exclusivement |
| Database | Supabase PostgreSQL + RLS | Sessions, traces, métriques |
| Auth | Supabase Auth (email + Google OAuth) | |
| Paiements | Stripe (compte Nova séparé) | Checkout + Portal + Webhooks |
| IA | Claude API — claude-sonnet-4-6 | Smart Alerts + Cost Autopilot |
| Slack | Slack API (OAuth + slash commands + webhooks) | Bot interactif + alertes |
| Deploy backend | Railway | |
| Deploy frontend | Vercel | |
| DNS | Cloudflare | |
| Monitoring | Sentry | |
| Email | Brevo | Alertes + onboarding |
| Analytics | Plausible | |
| CI/CD | GitHub Actions | |

---

## 8. PROVIDERS SUPPORTÉS

### Au launch (V1 — Avril 2026)

| Provider | Modèles | Pricing auto |
|----------|---------|-------------|
| OpenAI | GPT-4o, GPT-4, GPT-3.5, GPT-4o-mini | Oui |
| Anthropic | Claude Sonnet, Haiku, Opus | Oui |
| Google | Gemini Pro, Flash | Oui |
| Custom / Self-hosted | Tout modèle | Manuel |

### V2 (Mai 2026)

| Provider | Pricing auto |
|----------|-------------|
| Mistral | Oui |
| Cohere | Oui |
| xAI (Grok) | Oui |
| DeepSeek | Oui |

---

## 9. CONCURRENCE ET POSITIONNEMENT

| Concurrent | Type | Forces | Faiblesses | Notre avantage |
|------------|------|--------|------------|---------------|
| LangSmith | Observabilité | Traces riches, intégration LangChain | Lock-in LangChain, $39/seat, pas de guardrails | Framework-agnostic, 1 ligne, protect inclus |
| Helicone | Proxy monitoring | Riche, open-source | Proxy = point de défaillance, complexe | Pas de proxy, setup immédiat |
| Langfuse | Observabilité OSS | Gratuit, self-host | Basique, pas de guardrails, pas d'alertes IA | Smart Alerts, Cost Autopilot, UI premium |
| Braintrust | Enterprise | Complet, eval inclus | Prix enterprise, trop complexe pour 3-30 | Onboarding rapide, prix abordable |
| Portkey | Proxy + routing | Multi-provider, budget controls | Orienté routing, pricing par logs | Spécialisé observabilité, pas de proxy |

**Position :** AgentShield est la seule suite qui combine Monitor + Replay + Protect en un seul produit, framework-agnostic, avec une UI premium et un setup en 1 ligne.

**Ce qui nous différencie de TOUS les concurrents :**

- 3 modules en 1 produit (personne d'autre ne combine les trois)
- Smart Alerts avec diagnostic IA (pas juste une notification)
- Cost Autopilot (économies chiffrées automatiques)
- PII redaction + guardrails (protect intégré, pas un add-on)
- Setup 1 ligne de code, pas de proxy
- Framework-agnostic (LangChain, CrewAI, AutoGen, custom)
- UI dark mode premium (pas un dashboard 2018)

**Conséquence technique :** On ne build JAMAIS de feature qui transforme AgentShield en proxy. On reste une suite d'observabilité qui se branche sur l'existant.

---

## 10. INTÉGRATION

### Option 1 — SDK Python (recommandée, 1 ligne)

```python
# Installation
pip install agentshield

# Usage basique — décorateur
from agentshield import shield

@shield(agent="my-agent")
def call_openai(prompt):
    response = openai.chat.completions.create(...)
    return response

# Usage avec session (pour Replay)
from agentshield import shield, session

with session("ticket-123"):
    @shield(agent="classifier", step=1)
    def classify(text):
        ...

    @shield(agent="responder", step=2)
    def respond(category):
        ...

# Budget cap + kill switch (Protect)
from agentshield import shield, set_budget

set_budget(agent="my-agent", max_usd=50.0, period="monthly")

@shield(agent="my-agent")
def call_openai(prompt):
    # Lève BudgetExceededError si le cap est atteint
    response = openai.chat.completions.create(...)
    return response
```

### Option 2 — Middleware frameworks

```python
# LangChain
from agentshield.integrations import LangChainCallback
callbacks = [LangChainCallback(api_key="YOUR_KEY", agent="my-agent")]

# CrewAI
from agentshield.integrations import CrewAICallback
```

### Option 3 — API directe

```python
import requests

requests.post("https://api.agentshield.one/v1/track", json={
    "agent": "my-agent",
    "model": "gpt-4o",
    "input_tokens": 1250,
    "output_tokens": 340,
    "session_id": "ticket-123",
    "step": 3,
    "step_name": "classify",
    "input_text": "Customer says: I need help with billing",
    "output_text": "Category: billing_inquiry"
}, headers={"Authorization": f"Bearer {API_KEY}"})
```

**Temps d'intégration :** 2 minutes (SDK), 10 minutes (API directe).

---

## 11. MÉTRIQUES CIBLES

### Phase 1 — Launch (Avril 2026)

| Métrique | Cible |
|----------|-------|
| Signups jour J | 100+ |
| Clients payants M1 | 15-25 |
| MRR fin M1 | €500-1 000 |
| Conversion free → paid | >5% |

### Phase 2 — Traction (Mai-Juin 2026)

| Métrique | Cible |
|----------|-------|
| Clients payants | 80-150 |
| MRR | €3 000-6 000 |
| Churn mensuel | <5% |
| NPS | >40 |

### Kill criteria / Go criteria

| Situation après 12 semaines | Décision |
|-----------------------------|----------|
| < 200€ MRR | Kill — documenter, passer au suivant |
| 200-500€ MRR | Itérer — pas de kill, pas d'accélération |
| > 500€ MRR | Double down |
| > 2 000€ MRR | All-in — focus total |

---

## 12. ÉCOSYSTÈME NOVA

AgentShield est le Tool #1. Il est la porte d'entrée du portfolio de 6 SaaS.

```
AgentShield Monitor détecte un coût anormal
    → Smart Alert : "Your agent spent 3x more than usual on step 4"
    → Replay s'ouvre automatiquement sur le step 4

AgentShield Replay identifie le problème
    → "This prompt is 4x longer than needed — Cost Autopilot recommends GPT-4o-mini here"

AgentShield Protect empêche la récurrence
    → Budget cap automatique + kill switch + PII redaction
```

Le SDK est conçu comme un package unique. Les 3 modules sont activés au niveau du plan — un seul import, un seul décorateur.

---

## 13. RÈGLES ABSOLUES

Ces règles s'appliquent à tout le code, toute la doc, tout le contenu généré par Claude Code.

1. **Zéro proxy.** AgentShield n'intercepte JAMAIS le trafic API. On capture les métadonnées et les traces, pas le trafic réseau.
2. **Zéro données sensibles non consenties.** Les inputs/outputs sont capturés pour Replay UNIQUEMENT si le plan le permet. PII redaction appliquée par défaut. Le user peut désactiver la capture des contenus.
3. **Zéro feature creep.** Si une feature ne sert pas Monitor, Replay, ou Protect, elle n'existe pas.
4. **Zéro mention d'identité réelle.** Jamais de référence à FoundryTwo, Fabrice, ou toute autre identité dans le code, les commentaires, les commits, les configs.
5. **Zéro chiffre inventé.** Les données de démo utilisent des chiffres réalistes mais clairement marqués comme exemples.
6. **Zéro dépendance inutile.** Chaque package ajouté doit être justifié. Stack légère.
7. **Zéro shortcut sécurité.** RLS Supabase sur chaque table. Auth vérifié sur chaque endpoint. API keys hashées. PII redaction par défaut.
8. **SDK first.** L'expérience développeur du SDK est la priorité #1. Si `@shield()` est pénible à utiliser, le produit est mort.
9. **Anglais uniquement.** Tout le code, les commentaires, les messages d'erreur, l'UI, la doc publique.
10. **Mobile-friendly.** Le dashboard doit être lisible sur mobile.
11. **Value from day 1.** Un utilisateur free doit voir de la valeur dès le premier event tracké — anomaly detection et forecast marchent sans configuration.
12. **Proactif, pas passif.** AgentShield ne se contente pas de montrer des données. Il diagnostique, protège, recommande. C'est ce qui le rend indispensable.
13. **Privacy by default.** PII redaction activée par défaut. Le user doit explicitement choisir de stocker les contenus bruts.

---

> **Règle de mise à jour :** Ce fichier est la vérité sur AgentShield.
> Si une décision produit contredit ce fichier → mettre ce fichier à jour ET logger la décision dans CHANGELOG.md avec le raisonnement.
> Le produit évolue. La documentation aussi.
