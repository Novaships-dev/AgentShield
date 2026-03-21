# BACKUP.md — Backup & Restore AgentShield

> Ce fichier définit la stratégie de backup pour chaque composant : DB, Redis, configs, secrets. Claude Code le lit avant de toucher à la gestion des données persistantes.
> Cohérent avec : DEPLOY.md (infrastructure), MIGRATIONS.md (schéma DB), ENV.md (secrets)
> Dernière mise à jour : mars 2026

---

## 1. QU'EST-CE QU'ON BACKUP

| Composant | Données | Criticité | Perte acceptable |
|-----------|---------|-----------|-----------------|
| Supabase PostgreSQL | Users, orgs, agents, events, sessions, configs, alertes, guardrails, audit log | 🔴 Critique | 0 (zéro perte) |
| Redis | Cache, counters, Celery queue | 🟡 Faible | Totale (cache se reconstruit, queue se replay) |
| Stripe | Clients, abonnements, factures | 🟢 Géré par Stripe | N/A (Stripe est le source of truth) |
| Code source | Git repo | 🟢 Géré par GitHub | N/A (GitHub est le source of truth) |
| Variables d'env | Secrets, clés API | 🔴 Critique | 0 (mais reconstructible manuellement) |
| Fichiers générés | PDFs rapports | 🟡 Faible | 7 jours (les rapports sont regénérables) |

**Résumé : la seule chose qu'on doit backup activement c'est Supabase PostgreSQL.**

---

## 2. SUPABASE — BACKUP AUTOMATIQUE

### Plan Free (au lancement)

```
Supabase Free = PAS de backup automatique.

Stratégie : backup manuel quotidien via pg_dump.
```

### Script de backup manuel

```bash
#!/bin/bash
# scripts/backup-db.sh
# Exécuter quotidiennement via cron ou GitHub Actions

set -euo pipefail

# Variables
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/agentshield-backups"
BACKUP_FILE="${BACKUP_DIR}/agentshield_${DATE}.sql.gz"
RETENTION_DAYS=30

# Créer le répertoire
mkdir -p "${BACKUP_DIR}"

# Dump la base (exclure les tables Supabase internes)
pg_dump "${DATABASE_URL}" \
  --no-owner \
  --no-privileges \
  --exclude-schema='auth' \
  --exclude-schema='storage' \
  --exclude-schema='realtime' \
  --exclude-schema='extensions' \
  --exclude-schema='_analytics' \
  --exclude-schema='supabase_functions' \
  | gzip > "${BACKUP_FILE}"

# Vérifier la taille (alerte si < 1KB = probablement vide)
SIZE=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat --printf="%s" "${BACKUP_FILE}")
if [ "${SIZE}" -lt 1024 ]; then
  echo "ERROR: Backup file is suspiciously small (${SIZE} bytes)"
  exit 1
fi

echo "Backup created: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Cleanup des vieux backups
find "${BACKUP_DIR}" -name "agentshield_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "Cleaned up backups older than ${RETENTION_DAYS} days"
```

### GitHub Actions — Backup quotidien

```yaml
# .github/workflows/backup-db.yml

name: Daily DB Backup

on:
  schedule:
    - cron: "0 3 * * *"  # Chaque jour à 3h UTC
  workflow_dispatch:       # Déclenchable manuellement

jobs:
  backup:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client

      - name: Create backup
        env:
          DATABASE_URL: ${{ secrets.SUPABASE_DATABASE_URL }}
        run: |
          DATE=$(date +%Y%m%d_%H%M%S)
          pg_dump "${DATABASE_URL}" \
            --no-owner \
            --no-privileges \
            --exclude-schema='auth' \
            --exclude-schema='storage' \
            --exclude-schema='realtime' \
            --exclude-schema='extensions' \
            --exclude-schema='_analytics' \
            --exclude-schema='supabase_functions' \
            | gzip > "backup_${DATE}.sql.gz"

          echo "BACKUP_FILE=backup_${DATE}.sql.gz" >> $GITHUB_ENV
          echo "Backup size: $(du -h backup_${DATE}.sql.gz | cut -f1)"

      - name: Upload to GitHub Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.run_id }}
          path: ${{ env.BACKUP_FILE }}
          retention-days: 30

      - name: Notify on failure
        if: failure()
        run: |
          curl -X POST "${{ secrets.SLACK_OPS_WEBHOOK }}" \
            -H "Content-Type: application/json" \
            -d '{"text": "🔴 AgentShield DB backup FAILED. Check GitHub Actions."}'
```

### Plan Supabase Pro (après traction)

```
Supabase Pro ($25/mois) inclut :
  - Backup automatique quotidien (7 jours de rétention)
  - Point-in-time recovery (PITR) — restaurer à n'importe quel moment
  - Pas besoin du script manuel ci-dessus

Quand migrer vers Pro :
  - Dès qu'on a > 10 clients payants
  - OU dès que la DB dépasse 400 MB
  - OU dès qu'on active le compliance mode (qui interdit la perte de données)
```

---

## 3. RESTORE — SUPABASE

### Restore depuis un backup pg_dump

```bash
#!/bin/bash
# scripts/restore-db.sh
# ⚠️ DESTRUCTIF — uniquement en staging ou en cas d'urgence en prod

set -euo pipefail

BACKUP_FILE=$1

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: ./restore-db.sh <backup_file.sql.gz>"
  exit 1
fi

echo "⚠️  WARNING: This will OVERWRITE the current database."
echo "    Backup file: ${BACKUP_FILE}"
echo "    Target: ${DATABASE_URL}"
read -p "    Type 'RESTORE' to confirm: " CONFIRM

if [ "${CONFIRM}" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

# Décompresser et restaurer
gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"

echo "Restore complete. Verifying..."

# Vérification basique
psql "${DATABASE_URL}" -c "SELECT count(*) FROM organizations;" || echo "WARN: organizations table check failed"
psql "${DATABASE_URL}" -c "SELECT count(*) FROM events;" || echo "WARN: events table check failed"

echo "Done. Check the application and run smoke tests."
```

### Restore sur Supabase Pro (PITR)

```
1. Aller dans Supabase Dashboard → Project → Settings → Database
2. Section "Point-in-Time Recovery"
3. Choisir la date et l'heure de restauration
4. Confirmer → Supabase crée un nouveau projet avec les données à ce point
5. Mettre à jour les SUPABASE_URL et les clés dans les env vars
6. Tester puis switcher le DNS

Note : PITR crée un NOUVEAU projet. L'ancien reste intact.
       On peut donc tester avant de switcher.
```

---

## 4. REDIS — PAS DE BACKUP

```
Redis n'est PAS backupé. Voici pourquoi et comment on gère :

Données dans Redis :
  - Cache (pricing, API keys, analytics, guardrails, PII config)
    → Se reconstruit automatiquement depuis la DB (TTL-based)

  - Rate limit counters
    → Se réinitialisent naturellement (TTL = window duration)

  - Budget counters
    → Synchronisés avec la DB toutes les 5 minutes par Celery
    → En cas de perte Redis : le counter repart de la valeur DB
    → Impact : quelques events pourraient passer malgré un cap atteint (fail open)

  - Celery queue (tasks en attente)
    → Les tasks schedulées sont re-envoyées par Celery Beat au prochain cycle
    → Les tasks event-driven (alertes, webhooks) sont perdues
    → Impact : quelques alertes manquées, rattrapage au prochain event

  - WebSocket Pub/Sub
    → Connexions se reconnectent automatiquement
    → Les events manqués pendant le downtime ne sont pas rattrapés
    → Impact : trou de quelques secondes dans le dashboard temps réel

Conclusion : la perte de Redis est gênante (quelques minutes de données de cache perdues)
             mais JAMAIS catastrophique. Toutes les données critiques sont dans Supabase.
```

### Recovery Redis

```
Si Redis est totalement perdu :

1. Railway > Redis > Restart (ou re-create si nécessaire)
2. Mettre à jour REDIS_URL si l'URL change
3. Restart les services backend (worker, beat, api)
4. Le cache se re-remplit automatiquement au fil des requêtes
5. Budget counters se re-synchronisent au prochain cycle Celery (< 5 min)
6. Les tasks schedulées reprennent via Beat

Durée totale de recovery : < 10 minutes
```

---

## 5. VARIABLES D'ENVIRONNEMENT — BACKUP

```
Les secrets ne sont PAS dans le code. Ils sont dans :
  - Railway environment variables (backend)
  - Vercel environment variables (frontend)
  - GitHub Actions secrets (CI/CD)
  - Supabase Dashboard (DB settings)
  - Stripe Dashboard (API keys)

Stratégie de backup :
  1. Maintenir un fichier .env.backup CHIFFRÉ localement (pas committé)
     → Contient toutes les variables de prod
     → Chiffré avec age ou gpg
     → Stocké localement sur la machine de Nova UNIQUEMENT

  2. Si toutes les variables sont perdues :
     → Stripe : régénérer dans le Dashboard Stripe
     → Supabase : régénérer dans Project Settings > API
     → Anthropic : régénérer dans Console Anthropic
     → Brevo : régénérer dans Dashboard Brevo
     → Slack : régénérer dans Slack App Management
     → Sentry : copier depuis Sentry Project Settings
     → Durée estimée : 30-60 minutes pour tout reconfigurer
```

### Chiffrement du backup local

```bash
# Créer le backup chiffré
cp backend/.env .env.backup.prod
age -p .env.backup.prod > .env.backup.prod.age
rm .env.backup.prod
# → Stocker .env.backup.prod.age en lieu sûr (PAS dans le repo)

# Restaurer
age -d .env.backup.prod.age > backend/.env
```

---

## 6. DONNÉES UTILISATEUR — SUPPRESSION ET EXPORT

### Suppression de compte (GDPR)

```python
# app/services/account.py

async def delete_organization(org_id: str) -> None:
    """Delete an organization and ALL its data. Irreversible."""
    # Ordre de suppression (respect des FK)
    tables_to_clean = [
        "webhook_deliveries",    # FK → webhook_endpoints
        "webhook_endpoints",     # FK → organizations
        "audit_log",             # FK → organizations
        "guardrail_violations",  # FK → guardrail_rules
        "guardrail_rules",       # FK → organizations
        "pii_configs",           # FK → organizations
        "alert_history",         # FK → alert_rules
        "alert_rules",           # FK → organizations
        "budget_caps",           # FK → organizations
        "anomaly_baselines",     # FK → organizations
        "shared_sessions",       # FK → organizations
        "aggregations_daily",    # FK → organizations
        "aggregations_hourly",   # FK → organizations
        "sessions",              # FK → organizations
        "events",                # FK → organizations
        "api_keys",              # FK → organizations
        "agents",                # FK → organizations
        "users",                 # FK → organizations
        "organizations",         # PK
    ]

    for table in tables_to_clean:
        if table == "organizations":
            await db.from_(table).delete().eq("id", org_id).execute()
        else:
            await db.from_(table).delete().eq("organization_id", org_id).execute()

    # Supprimer le Stripe customer
    org = await get_org(org_id)
    if org.get("stripe_customer_id"):
        stripe.Customer.delete(org["stripe_customer_id"])

    # Supprimer le user dans Supabase Auth
    users = await db.from_("users").select("id").eq("organization_id", org_id).execute()
    for user in users.data:
        await supabase_admin.auth.admin.delete_user(user["id"])
```

### Export GDPR (Team plan)

```python
async def generate_gdpr_export(org_id: str) -> str:
    """Generate a complete data export for GDPR compliance."""
    export = {
        "organization": await get_org(org_id),
        "users": await get_users(org_id),
        "agents": await get_agents(org_id),
        "events_count": await count_events(org_id),
        "events_sample": await get_recent_events(org_id, limit=1000),
        "sessions_count": await count_sessions(org_id),
        "alert_rules": await get_alert_rules(org_id),
        "budget_caps": await get_budget_caps(org_id),
        "guardrail_rules": await get_guardrail_rules(org_id),
        "pii_config": await get_pii_config(org_id),
        "api_keys": await get_api_keys_metadata(org_id),  # Metadata only, pas les hash
        "audit_log": await get_audit_log(org_id),
        "exported_at": datetime.utcnow().isoformat(),
    }

    # Sauvegarder en JSON
    filename = f"gdpr_export_{org_id}_{datetime.utcnow().strftime('%Y%m%d')}.json"
    # Stocker temporairement (7 jours) et envoyer le lien par email

    return filename
```

---

## 7. DISASTER RECOVERY — SCÉNARIOS

### Scénario 1 : Supabase projet supprimé accidentellement

```
Impact   : Perte totale des données
Recovery :
  1. Restaurer depuis le dernier backup pg_dump (GitHub Artifacts)
  2. Créer un nouveau projet Supabase
  3. Restaurer le backup : ./scripts/restore-db.sh backup_xxx.sql.gz
  4. Mettre à jour SUPABASE_URL et les clés partout
  5. Redéployer backend + frontend
  Durée : 1-2 heures
  Perte : données entre le dernier backup et l'incident (max 24h)
```

### Scénario 2 : Railway account compromis

```
Impact   : Backend, workers, Redis potentiellement compromis
Recovery :
  1. Révoquer tous les tokens Railway
  2. Recréer les services sur un nouveau compte Railway
  3. Reconfigurer les variables d'env depuis le backup chiffré
  4. Redéployer
  5. Mettre à jour les DNS Cloudflare si les URLs Railway changent
  6. Changer TOUTES les API keys tierces (Stripe, Anthropic, etc.)
  Durée : 2-4 heures
  Perte : aucune donnée (tout est dans Supabase)
```

### Scénario 3 : GitHub repo supprimé

```
Impact   : Code source perdu
Recovery :
  1. Tous les collaborateurs ont un clone local → git push vers un nouveau repo
  2. Si aucun clone local → recréer depuis la documentation (docs/ + skills/ suffisent pour guider la reconstruction)
  Durée : 30 minutes si clone local, jours/semaines sinon
  Prévention : garder un clone local à jour sur la machine de Nova
```

### Scénario 4 : Data corruption (bug qui écrit des données fausses)

```
Impact   : Données incorrectes en DB
Recovery :
  1. Identifier le bug et le timestamp de début
  2. Si Supabase Pro (PITR) : restore au point avant le bug
  3. Si Supabase Free : restore depuis le dernier backup clean
  4. Fix le bug
  5. Redéployer
  Durée : 1-3 heures
  Prévention : tests automatisés, review avant merge, staging
```

---

## 8. SCHEDULE DE BACKUP

```
| Quoi | Fréquence | Rétention | Méthode |
|------|-----------|-----------|---------|
| DB Supabase (Free) | Quotidien 3h UTC | 30 jours | GitHub Actions pg_dump |
| DB Supabase (Pro) | Continu (PITR) | 7 jours | Supabase managed |
| Env vars | À chaque changement | 1 version | Fichier chiffré local |
| Code | Continu | Infini | GitHub |
| Redis | Jamais | N/A | Cache se reconstruit |
```

---

## 9. CHECKLIST BACKUP

```
□ Script backup-db.sh testé et fonctionnel
□ GitHub Actions backup-db.yml configuré et actif
□ Le backup est vérifié (taille > 1KB, pas de fichier vide)
□ Le restore est testé en staging (au moins 1 fois)
□ Les variables d'env sont sauvegardées localement (chiffrées)
□ Slack notification configurée si le backup échoue
□ La rétention est de 30 jours minimum
□ Le script de suppression de compte (GDPR) est testé
□ Le script d'export GDPR est testé
□ Les scénarios disaster recovery sont documentés et lus
```

---

> **Règle :** Un backup non testé n'est pas un backup. Tester le restore au moins une fois en staging avant le launch.
> La seule donnée critique est la DB Supabase. Tout le reste est reconstructible.
