# SKILL-STRIPE.md — Comment intégrer Stripe dans AgentShield

> Lire AVANT de toucher au billing, aux webhooks Stripe, ou aux plans.
> Réfs : WEBHOOKS.md (section Stripe), INTEGRATIONS.md, SPEC.md (section 24)

---

## SETUP

```python
import stripe
stripe.api_key = settings.stripe_secret_key
```

## CHECKOUT — CRÉER UN ABONNEMENT

```python
async def create_checkout(org_id: str, plan: str, success_url: str, cancel_url: str) -> str:
    price_map = {
        "starter": settings.stripe_price_starter,
        "pro": settings.stripe_price_pro,
        "team": settings.stripe_price_team,
    }

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_map[plan], "quantity": 1}],
        success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        metadata={"organization_id": org_id, "plan": plan},
        allow_promotion_codes=True,
        customer_email=user_email,  # Pré-remplir si connu
    )
    return session.url
```

## PORTAL — GÉRER L'ABONNEMENT

```python
async def create_portal(customer_id: str, return_url: str) -> str:
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return session.url
```

## WEBHOOKS — HANDLER

```python
@router.post("/billing/webhooks")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(400, "Invalid webhook")

    # Idempotence
    if await redis.get(f"stripe_event:{event['id']}"):
        return {"received": True}

    handlers = {
        "checkout.session.completed": handle_checkout_completed,
        "invoice.paid": handle_invoice_paid,
        "invoice.payment_failed": handle_payment_failed,
        "customer.subscription.updated": handle_subscription_updated,
        "customer.subscription.deleted": handle_subscription_deleted,
    }

    handler = handlers.get(event["type"])
    if handler:
        await handler(event)

    await redis.setex(f"stripe_event:{event['id']}", 172800, "1")
    return {"received": True}
```

## PLAN CONFIGS

```python
PLAN_CONFIGS = {
    "free":    {"max_agents": 1,      "max_requests": 10_000,      "history_days": 7,   "modules": ["monitor"]},
    "starter": {"max_agents": 5,      "max_requests": 100_000,     "history_days": 30,  "modules": ["monitor", "replay"]},
    "pro":     {"max_agents": 999999, "max_requests": 500_000,     "history_days": 90,  "modules": ["monitor", "replay", "protect"]},
    "team":    {"max_agents": 999999, "max_requests": 999_999_999, "history_days": 365, "modules": ["monitor", "replay", "protect"]},
}
```

## RÈGLES

```
1. Toujours vérifier la signature webhook (jamais skip)
2. Idempotence obligatoire (Redis TTL 48h)
3. Retourner 200 rapidement (Stripe retry après 5s)
4. Opérations longues → Celery tasks
5. Le plan Free n'a PAS de customer Stripe (géré côté app uniquement)
6. Test mode en dev/staging, live mode en prod UNIQUEMENT
7. Pas de secrets Stripe dans le frontend (pk_test_/pk_live_ seulement)
8. Logger chaque event webhook dans l'audit log
```
