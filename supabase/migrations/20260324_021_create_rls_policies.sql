-- Description: Row Level Security policies for all tables
-- Date: 2026-03-24
-- Dependencies: All previous migrations

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE POLICY "organizations_select_own"
    ON organizations FOR SELECT
    USING (id = auth.user_org_id());

CREATE POLICY "organizations_update_owner"
    ON organizations FOR UPDATE
    USING (id = auth.user_org_id())
    WITH CHECK (id = auth.user_org_id());

-- ============================================================
-- USERS
-- ============================================================
CREATE POLICY "users_select_own_org"
    ON users FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "users_update_self"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ============================================================
-- AGENTS
-- ============================================================
CREATE POLICY "agents_select_own_org"
    ON agents FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "agents_insert_own_org"
    ON agents FOR INSERT
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "agents_update_own_org"
    ON agents FOR UPDATE
    USING (organization_id = auth.user_org_id())
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "agents_delete_own_org"
    ON agents FOR DELETE
    USING (organization_id = auth.user_org_id());

-- ============================================================
-- EVENTS
-- ============================================================
CREATE POLICY "events_select_own_org"
    ON events FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "events_insert_own_org"
    ON events FOR INSERT
    WITH CHECK (organization_id = auth.user_org_id());

-- Events are immutable — no UPDATE or DELETE for regular users

-- ============================================================
-- AGGREGATIONS
-- ============================================================
CREATE POLICY "aggregations_hourly_select_own_org"
    ON aggregations_hourly FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "aggregations_daily_select_own_org"
    ON aggregations_daily FOR SELECT
    USING (organization_id = auth.user_org_id());

-- ============================================================
-- ALERT RULES
-- ============================================================
CREATE POLICY "alert_rules_select_own_org"
    ON alert_rules FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "alert_rules_insert_own_org"
    ON alert_rules FOR INSERT
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "alert_rules_update_own_org"
    ON alert_rules FOR UPDATE
    USING (organization_id = auth.user_org_id())
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "alert_rules_delete_own_org"
    ON alert_rules FOR DELETE
    USING (organization_id = auth.user_org_id());

-- ============================================================
-- ALERT HISTORY
-- ============================================================
CREATE POLICY "alert_history_select_own_org"
    ON alert_history FOR SELECT
    USING (organization_id = auth.user_org_id());

-- ============================================================
-- BUDGET CAPS
-- ============================================================
CREATE POLICY "budget_caps_select_own_org"
    ON budget_caps FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "budget_caps_insert_own_org"
    ON budget_caps FOR INSERT
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "budget_caps_update_own_org"
    ON budget_caps FOR UPDATE
    USING (organization_id = auth.user_org_id())
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "budget_caps_delete_own_org"
    ON budget_caps FOR DELETE
    USING (organization_id = auth.user_org_id());

-- ============================================================
-- ANOMALY BASELINES
-- ============================================================
CREATE POLICY "anomaly_baselines_select_own_org"
    ON anomaly_baselines FOR SELECT
    USING (organization_id = auth.user_org_id());

-- ============================================================
-- GUARDRAIL RULES
-- ============================================================
CREATE POLICY "guardrail_rules_select_own_org"
    ON guardrail_rules FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "guardrail_rules_insert_own_org"
    ON guardrail_rules FOR INSERT
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "guardrail_rules_update_own_org"
    ON guardrail_rules FOR UPDATE
    USING (organization_id = auth.user_org_id())
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "guardrail_rules_delete_own_org"
    ON guardrail_rules FOR DELETE
    USING (organization_id = auth.user_org_id());

-- ============================================================
-- GUARDRAIL VIOLATIONS
-- ============================================================
CREATE POLICY "guardrail_violations_select_own_org"
    ON guardrail_violations FOR SELECT
    USING (organization_id = auth.user_org_id());

-- ============================================================
-- PII CONFIGS
-- ============================================================
CREATE POLICY "pii_configs_select_own_org"
    ON pii_configs FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "pii_configs_insert_own_org"
    ON pii_configs FOR INSERT
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "pii_configs_update_own_org"
    ON pii_configs FOR UPDATE
    USING (organization_id = auth.user_org_id())
    WITH CHECK (organization_id = auth.user_org_id());

-- ============================================================
-- API KEYS
-- ============================================================
CREATE POLICY "api_keys_select_own_org"
    ON api_keys FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "api_keys_insert_own_org"
    ON api_keys FOR INSERT
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "api_keys_update_own_org"
    ON api_keys FOR UPDATE
    USING (organization_id = auth.user_org_id())
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "api_keys_delete_own_org"
    ON api_keys FOR DELETE
    USING (organization_id = auth.user_org_id());

-- ============================================================
-- WEBHOOK ENDPOINTS
-- ============================================================
CREATE POLICY "webhook_endpoints_select_own_org"
    ON webhook_endpoints FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "webhook_endpoints_insert_own_org"
    ON webhook_endpoints FOR INSERT
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "webhook_endpoints_update_own_org"
    ON webhook_endpoints FOR UPDATE
    USING (organization_id = auth.user_org_id())
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "webhook_endpoints_delete_own_org"
    ON webhook_endpoints FOR DELETE
    USING (organization_id = auth.user_org_id());

-- ============================================================
-- WEBHOOK DELIVERIES
-- (access via endpoint ownership)
-- ============================================================
CREATE POLICY "webhook_deliveries_select_via_endpoint"
    ON webhook_deliveries FOR SELECT
    USING (
        endpoint_id IN (
            SELECT id FROM webhook_endpoints
            WHERE organization_id = auth.user_org_id()
        )
    );

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE POLICY "audit_log_select_own_org"
    ON audit_log FOR SELECT
    USING (organization_id = auth.user_org_id());

-- Audit log is append-only — no UPDATE or DELETE policies

-- ============================================================
-- SESSIONS
-- ============================================================
CREATE POLICY "sessions_select_own_org"
    ON sessions FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "sessions_insert_own_org"
    ON sessions FOR INSERT
    WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "sessions_update_own_org"
    ON sessions FOR UPDATE
    USING (organization_id = auth.user_org_id())
    WITH CHECK (organization_id = auth.user_org_id());

-- ============================================================
-- SHARED SESSIONS
-- ============================================================
CREATE POLICY "shared_sessions_select_own_org"
    ON shared_sessions FOR SELECT
    USING (organization_id = auth.user_org_id());

CREATE POLICY "shared_sessions_insert_own_org"
    ON shared_sessions FOR INSERT
    WITH CHECK (organization_id = auth.user_org_id());
