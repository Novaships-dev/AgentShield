# SKILL-ALERTS.md — Comment coder le système d'alertes AgentShield

> Lire AVANT de toucher aux alertes, anomaly detection, ou Smart Alerts.
> Réfs : SPEC.md (sections 5-6), QUEUE.md (tasks_alerts, tasks_anomaly, tasks_smart_alerts)

---

## FLOW COMPLET

```
Event ingéré (POST /v1/track)
    │
    ├── [ASYNC] check_alert_thresholds.delay(org_id, agent_id)
    │      ├── Charger les alert_rules actives pour cet org/agent
    │      ├── Pour chaque rule : évaluer la métrique
    │      ├── Si threshold dépassé ET cooldown expiré :
    │      │   ├── Insérer dans alert_history
    │      │   ├── send_alert_email.delay() ou send_alert_slack.delay()
    │      │   ├── smart_alert_diagnose.delay() (si Pro+)
    │      │   ├── Publier sur WebSocket : alert_fired
    │      │   └── Mettre à jour last_triggered
    │      └── Fin
    │
    └── [ASYNC] check_anomaly.delay(org_id, agent_id, event_data)
           ├── Charger la baseline (mean, stddev)
           ├── Calculer le z-score
           ├── Si |z| > 3 (spike) ou z < -2 (drop) :
           │   ├── Créer une alerte anomaly
           │   ├── Notifications (email/Slack)
           │   └── WebSocket : anomaly
           └── Mettre à jour la baseline (moving average)
```

## ÉVALUATION DES MÉTRIQUES

```python
async def evaluate_metric(org_id: str, agent_id: str | None, metric: str) -> float:
    """Calculate the current value of a metric."""
    now = datetime.utcnow()

    if metric == "cost_daily":
        start = now.replace(hour=0, minute=0, second=0)
        return await sum_cost(org_id, agent_id, start, now)

    elif metric == "cost_weekly":
        start = now - timedelta(days=now.weekday())
        return await sum_cost(org_id, agent_id, start.replace(hour=0), now)

    elif metric == "cost_monthly":
        start = now.replace(day=1, hour=0, minute=0, second=0)
        return await sum_cost(org_id, agent_id, start, now)

    elif metric == "requests_daily":
        start = now.replace(hour=0, minute=0, second=0)
        return await count_events(org_id, agent_id, start, now)

    elif metric == "requests_hourly":
        start = now - timedelta(hours=1)
        return await count_events(org_id, agent_id, start, now)

    elif metric == "error_rate":
        return await calc_error_rate(org_id, agent_id, hours=1)
```

## COOLDOWN

```python
def should_trigger(rule: dict) -> bool:
    """Check if the rule can trigger (cooldown expired)."""
    if not rule["last_triggered"]:
        return True
    elapsed = datetime.utcnow() - rule["last_triggered"]
    return elapsed.total_seconds() > rule["cooldown_minutes"] * 60
```

## ANOMALY DETECTION — Z-SCORE

```python
def check_anomaly(current: float, baseline: dict) -> dict:
    if baseline["sample_count"] < 100:
        return {"is_anomaly": False, "reason": "insufficient_samples"}

    if baseline["stddev"] == 0:
        return {"is_anomaly": current != baseline["mean"], "z_score": float("inf")}

    z = (current - baseline["mean"]) / baseline["stddev"]

    if z > 3:
        return {"is_anomaly": True, "type": "spike", "z_score": z}
    elif z < -2:
        return {"is_anomaly": True, "type": "drop", "z_score": z}
    return {"is_anomaly": False, "z_score": z}
```

## SMART ALERTS — CLAUDE API

```python
@shared_task(name="smart_alerts.diagnose", bind=True, max_retries=2)
def diagnose_alert(self, alert_history_id: str):
    # 1. Charger le contexte
    # 2. Appeler Claude API (prompt structuré, JSON response)
    # 3. Stocker diagnosis + suggested_fix dans alert_history
    # 4. Mettre à jour la notification (email/Slack follow-up avec le diagnostic)
    # Timeout : 30s max. Si fail → la notification basique est déjà partie.
```

## RÈGLES

```
1. Les alertes sont ASYNC — ne jamais bloquer POST /v1/track
2. Le cooldown est vérifié AVANT d'évaluer la métrique (perf)
3. Les anomalies sont automatiques — pas de config user nécessaire
4. La baseline se met à jour en continu (exponential moving average, α=0.1)
5. Smart Alerts = Pro+ uniquement (vérifier le plan)
6. Max 20 alert rules par org
7. L'historique des alertes suit la rétention du plan
```
