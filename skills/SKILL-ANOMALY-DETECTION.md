# SKILL-ANOMALY-DETECTION.md — Comment coder l'anomaly detection

> Lire AVANT de toucher au z-score, aux baselines, ou aux alertes anomaly. Réfs : SPEC.md (section 6), QUEUE.md

---

## ALGORITHME

```
Baseline : mean + stddev par (org, agent, metric, hour_of_day, day_of_week)
  → Chaque agent a sa propre "normale" pour chaque heure de chaque jour
  → Exemple : "support-agent" le mardi à 14h fait normalement ~120 requêtes/h (±35)

Z-score : z = (valeur_actuelle - mean) / stddev
  → z > 3  : SPIKE (3 sigma au-dessus de la normale)
  → z < -2 : DROP (2 sigma en dessous — l'agent est peut-être cassé)
  → |z| ≤ 3 : normal

Phase d'apprentissage : 7 premiers jours (100+ events minimum)
  → Pas d'alerte pendant cette phase
  → On collecte les données pour calculer la première baseline

Moving average : exponential (α = 0.1)
  → La baseline évolue lentement pour s'adapter aux changements de pattern
  → new_mean = α * current_value + (1 - α) * old_mean
  → new_stddev = sqrt(α * (current_value - new_mean)² + (1 - α) * old_stddev²)
```

## MÉTRIQUES SURVEILLÉES

```
cost_hourly       → coût total de l'agent cette heure
requests_hourly   → nombre de requêtes cette heure
error_rate_hourly → % d'erreurs cette heure
```

## IMPLÉMENTATION

```python
async def check_anomaly(org_id, agent_id, metric, current_value):
    now = datetime.utcnow()
    baseline = await get_baseline(org_id, agent_id, metric, now.hour, now.weekday())

    if not baseline or baseline["sample_count"] < 100:
        return None  # Pas assez de données

    if baseline["stddev"] == 0:
        return None  # Pas de variance, pas d'anomalie possible

    z = (current_value - baseline["mean"]) / baseline["stddev"]

    if z > 3:
        return {"type": "spike", "z_score": z, "multiplier": current_value / baseline["mean"]}
    elif z < -2:
        return {"type": "drop", "z_score": z}
    return None


async def update_baseline(org_id, agent_id, metric, current_value):
    """Exponential moving average update."""
    now = datetime.utcnow()
    alpha = 0.1

    baseline = await get_baseline(org_id, agent_id, metric, now.hour, now.weekday())

    if not baseline:
        # Premier point
        await upsert_baseline(org_id, agent_id, metric, now.hour, now.weekday(),
                              mean=current_value, stddev=0, sample_count=1)
        return

    new_mean = alpha * current_value + (1 - alpha) * baseline["mean"]
    new_stddev = math.sqrt(alpha * (current_value - new_mean)**2 + (1 - alpha) * baseline["stddev"]**2)
    new_count = baseline["sample_count"] + 1

    await upsert_baseline(org_id, agent_id, metric, now.hour, now.weekday(),
                          mean=new_mean, stddev=new_stddev, sample_count=new_count)
```

## RÈGLES

```
1. Automatique pour tous les agents (Starter+), pas de config nécessaire
2. Pas d'alerte si sample_count < 100 (pas assez fiable)
3. Pas d'alerte si stddev = 0 (l'agent est parfaitement constant — rare)
4. La baseline est par (agent, metric, heure, jour) — 7 × 24 = 168 baselines par agent par metric
5. L'update de baseline est dans un Celery task schedulé (toutes les heures à :30)
6. Le check d'anomalie est dans un Celery task triggered par chaque event
7. Le z-score threshold (3 / -2) est FIXE — pas configurable par l'utilisateur (simplicité)
```
