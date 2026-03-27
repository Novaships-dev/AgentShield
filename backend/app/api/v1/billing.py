"""Billing endpoints — Stripe checkout, portal, and incoming webhooks."""
from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.schemas.billing import CheckoutRequest, CheckoutResponse, PortalResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["billing"])


def _require_owner(user: User = Depends(get_current_user)) -> User:
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Only the organization owner can manage billing.")
    return user


@router.post("/billing/checkout", response_model=CheckoutResponse, summary="Create Stripe Checkout session")
async def create_checkout(
    body: CheckoutRequest,
    user: User = Depends(_require_owner),
) -> CheckoutResponse:
    """Redirect the owner to Stripe Checkout to start a subscription."""
    from app.services.stripe_service import create_checkout_session
    try:
        url = create_checkout_session(
            org_id=user.organization_id,
            plan=body.plan,
            user_email=user.email,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error(f"[billing] checkout error: {exc}", exc_info=True)
        raise HTTPException(status_code=502, detail="Failed to create checkout session.")

    # Extract session_id from URL (Stripe embeds it after redirect if needed)
    session_id = url.split("session_id=")[-1] if "session_id=" in url else ""
    return CheckoutResponse(checkout_url=url, session_id=session_id)


@router.post("/billing/portal", response_model=PortalResponse, summary="Create Stripe Billing Portal session")
async def create_portal(
    request: Request,
    user: User = Depends(_require_owner),
    db=Depends(get_db),
) -> PortalResponse:
    """Open the Stripe Customer Portal for subscription management."""
    # Load org to get stripe_customer_id
    org_row = db.table("organizations").select("stripe_customer_id").eq("id", user.organization_id).maybe_single().execute()
    customer_id = (org_row.data or {}).get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(
            status_code=400,
            detail="No active Stripe subscription found. Please subscribe first.",
        )

    return_url = str(request.base_url).rstrip("/") + "/dashboard/settings"

    from app.services.stripe_service import create_portal_session
    try:
        url = create_portal_session(customer_id=customer_id, return_url=return_url)
    except Exception as exc:
        logger.error(f"[billing] portal error: {exc}", exc_info=True)
        raise HTTPException(status_code=502, detail="Failed to create portal session.")

    return PortalResponse(portal_url=url)


@router.post("/billing/webhooks", summary="Receive Stripe webhook events")
async def stripe_webhook(
    request: Request,
    db=Depends(get_db),
    redis=Depends(get_redis),
):
    """
    Stripe sends signed events here. Signature is verified before processing.
    No JWT auth — Stripe authenticates via the stripe-signature header.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    from app.services.stripe_service import handle_webhook_event
    try:
        handle_webhook_event(payload=payload, sig_header=sig_header, redis_client=redis, db_client=db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error(f"[billing] webhook processing error: {exc}", exc_info=True)
        # Return 200 to prevent Stripe from retrying a processing error
        return {"received": True, "error": "processing_error"}

    return {"received": True}
