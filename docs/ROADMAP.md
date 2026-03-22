# ROADMAP.md — Évolutions AgentShield

> Ce fichier définit ce qui vient APRÈS le launch V1. Claude Code le lit pour comprendre la direction du produit et ne pas prendre de décisions architecturales qui bloqueraient les évolutions futures.
> Cohérent avec : CONTEXT.md (vision), SPEC.md (V1 features), TASKS.md (implémentation V1)
> Dernière mise à jour : mars 2026

---

## 1. TIMELINE

```
V1 — Avril 2026      → Launch (Monitor + Replay + Protect base)
V1.1 — Mai 2026      → Polish + providers V2 + SDK JS/TS
V1.2 — Juin 2026     → Protect complet + compliance + intégrations natives
V2 — Juillet 2026    → Platform features + API publique
```

---

## 2. V1 — LAUNCH (Avril 2026)

Tout ce qui est dans SPEC.md. Le produit complet avec les 3 modules.

```
Monitor :
  ✅ Dashboard temps réel (WebSocket)
  ✅ Tracking par agent/workflow/provider/modèle
  ✅ Alertes seuils + anomaly detection
  ✅ Cost forecast
  ✅ Smart Alerts (diagnostic IA)
  ✅ Cost Autopilot (recommendations)
  ✅ Budget caps + kill switch
  ✅ Session/workflow costing

Replay :
  ✅ Session timeline step-by-step
  ✅ Inputs/outputs avec PII redaction
  ✅ Partage de session par URL
  ✅ Comparaison de sessions

Protect :
  ✅ Guardrails (keyword, regex, topic, category)
  ✅ PII redaction (email, phone, CC, SSN, IP + custom)
  ✅ Kill switch manuel
  ✅ Budget caps auto-freeze

SDK :
  ✅ Python SDK (@shield, session, set_budget)
  ✅ Intégrations : LangChain, CrewAI, AutoGen, LlamaIndex

Plans :
  ✅ Free / Starter €49 / Pro €99 / Team €199

Infra :
  ✅ FastAPI + Next.js + Supabase + Redis + Celery
  ✅ Railway + Vercel + Cloudflare
  ✅ CI/CD GitHub Actions
```

---

## 3. V1.1 — POLISH (Mai 2026)

Itérations basées sur les retours utilisateurs des premières semaines.

### Nouveaux providers

```
Ajout des providers V2 dans la pricing table :
  - Mistral (mistral-large, mistral-small, mistral-medium)
  - Cohere (command-r-plus, command-r)
  - xAI Grok (grok-2, grok-2-mini)
  - DeepSeek (deepseek-chat, deepseek-coder)
```

### SDK JavaScript/TypeScript

```typescript
// npm install agentshield

import { shield, session } from "agentshield";

const result = await shield({ agent: "my-agent" }, async () => {
  return await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
  });
});
```

### Améliorations UI

```
- Dashboard loading performance (skeleton → data)
- Mobile polish (responsive edge cases)
- Chart interactions (zoom, drill-down)
- Session timeline : keyboard navigation (←→ entre steps)
- Onboarding : analytics + amélioration du funnel basé sur les données
```

### Améliorations backend

```
- Query optimization (slow queries identifiées en V1)
- Cache warming au démarrage (pas de cold start)
- Batch insert pour les events haute fréquence (> 1000/min par org)
- Celery priority queues si nécessaire
```

---

## 4. V1.2 — PROTECT COMPLET (Juin 2026)

### Topic classification IA

```
V1 : classification par mots-clés groupés (simple, rapide)
V1.2 : classification par Claude API (plus précise, async)

Flow :
  1. Le check sync (middleware) utilise toujours les keyword groups (< 3ms)
  2. Si un event match un topic "suspect" → Celery task async
  3. La task appelle Claude API pour classifier précisément
  4. Si violation confirmée → alerte + log + action rétroactive
```

### Compliance mode complet

```
- Export audit log en CSV/JSON
- Rapport de compliance auto-généré (mensuel)
- Rétention configurable par org (au-delà du plan)
- Certification SOC2 readiness (documentation)
```

### Intégrations natives frameworks

```
Améliorations des callbacks :
  - LangGraph support (en plus de LangChain)
  - CrewAI v2 support
  - Haystack support
  - DSPy support
  - Auto-detection du framework (pas besoin de choisir le bon callback)
```

### Webhooks améliorés

```
- Webhook templates (Zapier, Make, n8n)
- Webhook playground (tester les payloads dans l'UI)
- Webhook filtering avancé (envoyer uniquement si cost > X)
```

---

## 5. V2 — PLATFORM (Juillet 2026)

### API publique documentée

```
- Documentation interactive (Swagger/Redoc ou custom)
- API playground dans l'UI (tester les endpoints live)
- Versioning explicite (v1 maintenu, v2 pour les breaking changes)
- Rate limits documentés par endpoint
- Webhooks event catalog interactif
```

### Dashboard embeddable

```
Les agences veulent montrer les coûts à leurs clients.
→ Iframe embeddable avec token d'accès limité
→ Vue read-only, branding personnalisable
→ Filtré par agent/session (le client ne voit que ses données)
```

### Multi-org (future)

```
Un user peut appartenir à plusieurs orgs.
→ Switcher d'org dans le dashboard
→ Cas d'usage : freelance qui gère plusieurs clients
→ Architecture : déjà prête (RLS par org_id)
→ Impact : modifier le flow auth pour supporter le multi-org
```

### Alertes avancées

```
- Alertes composites (SI cost > X ET error_rate > Y)
- Alertes sur les sessions (SI une session coûte > X)
- Alertes sur le Protect (SI > X violations en 1h)
- Scheduled digests (résumé quotidien/hebdo par email)
```

### Benchmarking

```
"How does your agent compare to others?"
→ Données anonymisées et agrégées cross-org
→ "Your support agent costs $0.45/session. Median for similar agents: $0.32."
→ Feature opt-in (les données ne sont jamais partagées sans consentement)
```

---

## 6. IDÉES BACKLOG (Non planifiées)

```
- SDK Go
- SDK Ruby
- Terraform provider (infrastructure as code)
- Grafana plugin (exporter les métriques vers Grafana)
- GitHub Action (track les coûts dans CI/CD)
- VS Code extension (voir les coûts inline dans l'éditeur)
- CLI tool (agentshield status depuis le terminal)
- Prompt optimization suggestions (pas juste model, mais prompt length)
- A/B testing de prompts (comparer le coût de deux versions)
- Cost anomaly RCA (Root Cause Analysis automatique)
- White-label (pour les agences qui veulent leur propre branding)
```

---

## 7. DÉCISIONS ARCHITECTURALES POUR LE FUTUR

### Ce qu'on a déjà préparé

```
✅ Multi-tenant (organization_id sur tout) → prêt pour multi-org
✅ RLS strict → prêt pour dashboard embeddable
✅ API versionnée (/v1/) → prêt pour /v2/ sans casser
✅ Celery queues séparées → prêt pour scaling workers
✅ Redis DB séparées → prêt pour scaling Redis
✅ SDK avec extractors → prêt pour nouveaux providers
✅ Callback pattern → prêt pour nouveaux frameworks
✅ PII patterns extensibles → prêt pour nouveaux patterns
✅ Guardrail types extensibles → prêt pour ML classification
```

### Ce qu'il faudra migrer

```
⚠️ Auth single-org → multi-org (migration users table + flow auth)
⚠️ Celery single instance → distributed (broker configuration)
⚠️ Supabase Free → Pro (backup auto, PITR, plus de connexions)
⚠️ Landing Next.js → possiblement séparé (si besoin de perf Edge pure)
```

---

## 8. KILL CRITERIA RAPPEL

```
Rappel de CONTEXT.md :

| Situation après 12 semaines | Décision |
|-----------------------------|----------|
| < 200€ MRR                 | Kill — documenter, passer au Tool #2 |
| 200-500€ MRR               | Itérer |
| > 500€ MRR                 | Double down |
| > 2 000€ MRR               | All-in |

La roadmap V1.1 et V1.2 ne se concrétise QUE si le launch V1 atteint les métriques.
Pas d'investissement émotionnel dans les features futures si le marché ne valide pas.
```

---

> **Règle :** La roadmap est un plan, pas une promesse. Elle change en fonction des données.
> Chaque feature future est une hypothèse. Seul le feedback utilisateur et le MRR la valident.
