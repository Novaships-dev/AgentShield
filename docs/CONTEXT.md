# CONTEXT.md — AgentCostGuard

> Source de vérité du projet. Chaque fichier du repo, chaque décision technique, chaque prompt Claude Code doit être cohérent avec ce document.
> Dernière mise à jour : mars 2026

---

## 1. EN UNE PHRASE

**"The budget app for AI spending."**

AgentCostGuard track les coûts d'APIs IA en temps réel — par agent, par workflow, par utilisateur — et alerte avant que la facture arrive.

Tool #1 de Nova (@NovaShips). Premier SaaS de l'écosystème.

---

## 2. LE PROBLÈME

Les équipes déploient des agents IA qui appellent des APIs (OpenAI, Anthropic, Gemini). Les coûts spiralent. Personne ne sait quel agent brûle le budget jusqu'à la facture mensuelle.

**Le scénario type :**

```
Semaine 1 : agent déployé. Tout fonctionne.
Semaine 2 : l'agent loop sur un edge case. 50 000 appels API.
Fin du mois : facture de $847. Surprise totale.
```

**Ce que les devs font aujourd'hui :**

- Regarder le dashboard du provider → pas de détail par agent
- Logger manuellement dans des fichiers → pas scalable, pas temps réel
- Ne rien faire et subir les surprises → la majorité

**Pourquoi c'est douloureux maintenant :**

- Les APIs IA sont de plus en plus chères à mesure que les usages augmentent
- Les agents font des milliers d'appels sans supervision
- 85% des équipes dépassent leur budget IA de >10% par mois
- Les providers ne fournissent aucune granularité au niveau agent

---

## 3. LA SOLUTION

Dashboard self-serve qui se branche en 2 minutes.

**Ce qu'il fait :**

- Track les coûts en temps réel par agent, par workflow, par user, par jour
- Alerte Slack/email quand un seuil est dépassé
- Recommande des optimisations (quel modèle utiliser, où cacher, quels prompts raccourcir)
- Génère des rapports PDF pour les équipes et les clients

**Ce qu'il ne fait PAS :**

- Il n'est PAS un proxy complet (pas Helicone)
- Il ne fait PAS du replay visuel (c'est AgentReplay — Tool #2)
- Il ne fait PAS de guardrails de sécurité (c'est AgentGate — Tool #3)

**L'analogie :** Mint pour les dépenses IA. Simple, beau, actionnable.

---

## 4. ICP — QUI ACHÈTE

### Persona primaire — Le dev solo / indie hacker (60% des clients)

- Développeur seul ou en équipe de 2-5
- Déploie 1-5 agents IA en production
- Budget serré — chaque dollar compte
- Utilise OpenAI ou Anthropic API directement
- Pain : pas de visibilité sur ce que chaque agent coûte
- Willingness to pay : €19-49/mois
- Canal : Twitter, Reddit r/LocalLLaMA, IndieHackers

### Persona secondaire — La startup early-stage (30% des clients)

- Équipe de 5-20 personnes
- Plusieurs agents en production
- Investisseurs qui demandent des rapports de coûts
- Pain : impossible de savoir quel agent est rentable
- Willingness to pay : €49-99/mois
- Canal : Product Hunt, cold outreach LinkedIn/Twitter

### Persona tertiaire — L'agence IA (10% des clients)

- Agence qui deploy des agents pour des clients
- Doit facturer les coûts IA à ses clients
- Pain : impossible de répartir les coûts par client
- Willingness to pay : €99/mois (plan Team)
- Canal : Bouche à oreille, partnerships

---

## 5. PRICING

| Plan | Prix/mois | Agents | Requêtes/mois | Historique | Alertes | Recommandations IA |
|------|-----------|--------|---------------|------------|---------|-------------------|
| Free | €0 | 1 | 10 000 | 7 jours | Non | Non |
| Starter | €19 | 5 | 100 000 | 30 jours | Slack + email | Non |
| Pro | €49 | Illimité | 500 000 | 90 jours | Illimitées | Oui |
| Team | €99 | Illimité | Illimité | 90 jours | Multi-user | Oui + PDF |

**ARPU cible :** €25/mois (mix Starter/Pro)
**Conversion free → paid cible :** 8%+
**Churn cible :** <5%/mois

---

## 6. STACK TECHNIQUE

| Layer | Technologie | Notes |
|-------|-------------|-------|
| Backend | FastAPI — Python 3.12+ | |
| Queue | Celery + Redis | Jobs de tracking async |
| Frontend | Next.js 14 + TypeScript + Tailwind + shadcn/ui | |
| Database | Supabase PostgreSQL + RLS | |
| Auth | Supabase Auth (email + Google OAuth) | |
| Paiements | Stripe (compte Nova séparé) | Checkout + Portal + Webhooks |
| IA | Claude API — claude-sonnet-4-20250514 | Recommandations d'optimisation |
| Deploy backend | Railway | |
| Deploy frontend | Vercel | |
| DNS | Cloudflare | |
| Monitoring | Sentry | |
| Email | Brevo | Alertes + onboarding |
| Analytics | Plausible | |
| CI/CD | GitHub Actions | |

---

## 7. PROVIDERS SUPPORTÉS

### Au launch (V1 — Avril 2026)

| Provider | Modèles | Pricing auto |
|----------|---------|-------------|
| OpenAI | GPT-4o, GPT-4, GPT-3.5 | Oui |
| Anthropic | Claude Sonnet, Haiku, Opus | Oui |
| Google | Gemini Pro, Flash | Oui |
| Custom / Self-hosted | Tout modèle | Manuel |

### V2 (Mai 2026)

| Provider | Pricing auto |
|----------|-------------|
| Mistral | Oui |
| Cohere | Oui |

---

## 8. CONCURRENCE ET POSITIONNEMENT

| Concurrent | Type | Forces | Faiblesses | Notre avantage |
|------------|------|--------|------------|---------------|
| Helicone | Proxy complet | Riche en features | Complexe, proxy = point de défaillance | Plus simple, pas de proxy |
| Portkey | Proxy + routing | Multi-provider | Orienté routing, pas cost tracking | Spécialisé cost tracking |
| LangSmith | Observabilité | Traces complètes | Lock-in LangChain, complexe | Framework-agnostic |
| Dashboard provider | Natif | Zéro setup | Pas de détail par agent, pas d'alerte | Granularité + alertes temps réel |

**Position :** AgentCostGuard est le seul outil **standalone** et **simple** dédié au cost tracking. Tous les autres le font comme feature dans un outil plus large.

**Conséquence technique :** On ne build JAMAIS de feature qui transforme AgentCostGuard en proxy. On reste un tracker léger qui se branche sur l'existant.

---

## 9. INTÉGRATION

### Option 1 — SDK Python (recommandée)

```python
# Installation
pip install agentcostguard

# Usage
from agentcostguard import track

@track(agent="my-agent-name")
def call_openai(prompt):
    response = openai.chat.completions.create(...)
    return response
```

### Option 2 — API directe

```python
import requests

requests.post("https://api.agentcostguard.io/v1/track", json={
    "agent": "my-agent-name",
    "model": "gpt-4o",
    "input_tokens": 1250,
    "output_tokens": 340,
    "cost_usd": 0.0234
}, headers={"Authorization": f"Bearer {API_KEY}"})
```

**Temps d'intégration :** 2-5 minutes (SDK), 10-15 minutes (API directe).

---

## 10. MÉTRIQUES CIBLES

### Phase 1 — Launch (Avril 2026)

| Métrique | Cible |
|----------|-------|
| Signups jour J | 50+ |
| Clients payants M1 | 10-15 |
| MRR fin M1 | €200-400 |
| Conversion free → paid | >5% |

### Phase 2 — Traction (Mai-Juin 2026)

| Métrique | Cible |
|----------|-------|
| Clients payants | 60-100 |
| MRR | €1 500-2 500 |
| Churn mensuel | <5% |
| NPS | >40 |

### Phase 3 — Validation (Juin 2026)

| Métrique | Cible go/no-go |
|----------|---------------|
| MRR | €2 000+ |
| Churn | <5% |
| Si atteint | Go AgentReplay (Tool #2) |
| Si non atteint | Itérer sur AgentCostGuard |

---

## 11. ÉCOSYSTÈME NOVA

AgentCostGuard est le Tool #1. Il ouvre la porte aux deux suivants.

```
AgentCostGuard (track les coûts)
    → même SDK
    → AgentReplay (comprend ce qui se passe)
    → même base clients
    → AgentGate (protège les agents)
```

**Cross-sell intégré au produit :**

```
AgentCostGuard détecte un coût anormal
    → Banner : "Want to know WHY this agent is expensive?"
    → Cross-sell AgentReplay

AgentCostGuard détecte un dépassement de budget
    → Banner : "Want to prevent this automatically?"
    → Cross-sell AgentGate
```

Le SDK est conçu pour être partagé — quand AgentReplay sort, l'utilisateur d'AgentCostGuard active une feature, pas une nouvelle intégration.

---

## 12. RÈGLES ABSOLUES

Ces règles s'appliquent à tout le code, toute la doc, tout le contenu généré par Claude Code.

1. **Zéro proxy.** AgentCostGuard n'intercepte JAMAIS le trafic API. On track les métadonnées uniquement (tokens, coût, agent name). Jamais le contenu des prompts.
2. **Zéro données sensibles.** On ne stocke ni les prompts, ni les réponses des APIs IA. Uniquement les métadonnées de coût.
3. **Zéro feature creep.** Si une feature ne sert pas directement le cost tracking ou les alertes, elle n'existe pas en V1.
4. **Zéro mention d'identité réelle.** Jamais de référence à FoundryTwo, Fabrice, ou toute autre identité dans le code, les commentaires, les commits, les configs.
5. **Zéro chiffre inventé.** Les données de démo utilisent des chiffres réalistes mais clairement marqués comme exemples.
6. **Zéro dépendance inutile.** Chaque package ajouté au projet doit être justifié. On garde la stack légère.
7. **Zéro shortcut sécurité.** RLS Supabase activé sur chaque table. Auth vérifié sur chaque endpoint. API keys hashées en base.
8. **SDK first.** L'expérience développeur du SDK est la priorité #1. Si le SDK est pénible à utiliser, le produit est mort.
9. **Anglais uniquement.** Tout le code, les commentaires, les messages d'erreur, l'UI, la doc publique — en anglais.
10. **Mobile-friendly.** Le dashboard doit être lisible sur mobile. Pas d'excuse.

---

> **Règle de mise à jour :** Ce fichier est la vérité sur AgentCostGuard.
> Si une décision produit contredit ce fichier → mettre ce fichier à jour ET logger la décision dans CHANGELOG.md avec le raisonnement.
> Le produit évolue. La documentation aussi.
