-- Description: Create webhook_deliveries table
-- Date: 2026-03-24
-- Dependencies: 20260324_016_create_webhook_endpoints.sql

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status_code     INT,
    attempt         INT NOT NULL DEFAULT 1,
    next_retry_at   TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries (endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries (next_retry_at) WHERE next_retry_at IS NOT NULL;

COMMENT ON TABLE webhook_deliveries IS 'Delivery log and retry queue for outbound webhook calls.';
COMMENT ON COLUMN webhook_deliveries.attempt IS 'Delivery attempt number (1-based). Max 5 retries.';
COMMENT ON COLUMN webhook_deliveries.next_retry_at IS 'Scheduled time for next retry attempt (null = delivered or exhausted)';
