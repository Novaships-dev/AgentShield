"""Brevo email notification service."""
from __future__ import annotations
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

SENDER_EMAIL_DEFAULT = "hello@agentshield.one"
SENDER_NAME_DEFAULT = "AgentShield"


def _wrap(body: str) -> str:
    style = """
<style>
body{margin:0;padding:0;background:#030014;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
.wrap{max-width:560px;margin:0 auto;padding:40px 20px;}
.card{background:#0f0a1e;border:1px solid #2a1f4e;border-radius:12px;padding:36px;}
.logo{font-size:22px;font-weight:700;color:#a78bfa;letter-spacing:-0.5px;margin-bottom:32px;display:block;}
h1{color:#e2d9f3;font-size:22px;margin:0 0 16px;font-weight:600;}
p{color:#9d8ec4;font-size:15px;line-height:1.6;margin:0 0 16px;}
.highlight{color:#e2d9f3;font-weight:600;}
.btn{display:inline-block;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff!important;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-top:8px;}
.stat-row{display:flex;gap:16px;margin:20px 0;}
.stat{flex:1;background:#1a1030;border:1px solid #2a1f4e;border-radius:8px;padding:16px;text-align:center;}
.stat-val{color:#a78bfa;font-size:24px;font-weight:700;display:block;}
.stat-lbl{color:#6b5c8a;font-size:12px;margin-top:4px;display:block;}
.divider{border:none;border-top:1px solid #2a1f4e;margin:24px 0;}
.footer-wrap{text-align:center;margin-top:28px;}
.footer-wrap p{color:#4a3d6b;font-size:12px;}
.badge{display:inline-block;background:#1a1030;border:1px solid #2a1f4e;color:#a78bfa;padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600;}
.warn{background:#1a0f0f;border:1px solid #4e1f1f;border-radius:8px;padding:16px;margin:16px 0;}
.warn p{color:#e2a0a0;margin:0;}
code{color:#a78bfa;background:#1a1030;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;}
</style>"""
    return (
        f'<!DOCTYPE html><html><head><meta charset="UTF-8">{style}</head>'
        f'<body><div class="wrap"><div class="card">'
        f'<span class="logo">&#x2B21; AgentShield</span>'
        f'{body}'
        f'</div><div class="footer-wrap"><p>AgentShield &middot; '
        f'<a href="https://agentshield.one" style="color:#4a3d6b;">agentshield.one</a>'
        f'</p></div></div></body></html>'
    )


class BrevoService:
    def __init__(self):
        from app.config import settings
        self._api_key = getattr(settings, "brevo_api_key", "")
        self._sender_email = getattr(settings, "brevo_sender_email", SENDER_EMAIL_DEFAULT)
        self._sender_name = getattr(settings, "brevo_sender_name", SENDER_NAME_DEFAULT)
        self._base_url = "https://api.brevo.com/v3"

    def _post(self, endpoint: str, payload: dict) -> bool:
        import json
        import urllib.request
        import urllib.error
        if not self._api_key:
            logger.warning("[brevo] BREVO_API_KEY not configured — email skipped")
            return False
        url = f"{self._base_url}{endpoint}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json", "api-key": self._api_key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status in (200, 201, 202)
        except urllib.error.HTTPError as exc:
            logger.error(f"[brevo] HTTP {exc.code}: {exc.read().decode()}")
            raise
        except Exception as exc:
            logger.error(f"[brevo] request failed: {exc}")
            raise

    def _send(self, to_email: str, subject: str, html_body: str) -> bool:
        return self._post("/smtp/email", {
            "sender": {"name": self._sender_name, "email": self._sender_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": _wrap(html_body),
        })

    # ── Welcome ───────────────────────────────────────────────────────────
    def send_welcome_email(self, to_email: str, first_name: str = "") -> bool:
        name_part = f", {first_name}" if first_name else ""
        body = f"""
<h1>Welcome to AgentShield{name_part} &#x1F44B;</h1>
<p>Your account is ready. Full observability over your AI agents &mdash;
costs, sessions, guardrails, and anomalies &mdash; in one dashboard.</p>
<div style="background:#1a1030;border:1px solid #2a1f4e;border-radius:10px;padding:20px 24px;margin:20px 0;">
  <p style="color:#c4b5fd;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 12px;">3 things to do first</p>
  <p style="margin:0 0 8px;">1&#xFE0F;&#x20E3; &nbsp;<strong style="color:#e2d9f3;">Install the SDK</strong> &mdash;
  <code>pip install agentshield</code></p>
  <p style="margin:8px 0;">2&#xFE0F;&#x20E3; &nbsp;<strong style="color:#e2d9f3;">Connect your first agent</strong> in the dashboard</p>
  <p style="margin:8px 0 0;">3&#xFE0F;&#x20E3; &nbsp;<strong style="color:#e2d9f3;">Set a budget cap</strong> to protect against runaway costs</p>
</div>
<a href="https://app.agentshield.one/dashboard" class="btn">Open Dashboard &#x2192;</a>
<p style="margin-top:16px;font-size:13px;color:#4a3d6b;">Need help? Reply to this email anytime.</p>
"""
        return self._send(to_email, "Welcome to AgentShield &#x2B21;", body)

    # ── Upgrade ───────────────────────────────────────────────────────────
    def send_upgrade_email(self, to_email: str, plan: str) -> bool:
        plan_display = plan.capitalize()
        features = {
            "starter": ["5 agents", "30-day history", "Email alerts", "Cost tracking"],
            "pro": ["Unlimited agents", "90-day history", "Anomaly detection", "Cost Autopilot", "Replay sharing", "Webhooks"],
            "team": ["Everything in Pro", "Team members", "SSO", "Priority support"],
        }
        feat_list = "".join(
            f"<li style='color:#9d8ec4;margin-bottom:6px;'>&#x2713; &nbsp;{f}</li>"
            for f in features.get(plan, [])
        )
        body = f"""
<h1>You're now on AgentShield {plan_display} &#x1F389;</h1>
<p>Your subscription is active. Here's what's now unlocked:</p>
<ul style="padding-left:20px;margin:16px 0;">{feat_list}</ul>
<hr class="divider">
<a href="https://app.agentshield.one/dashboard" class="btn">Go to Dashboard &#x2192;</a>
"""
        return self._send(to_email, f"&#x2705; AgentShield {plan_display} is active", body)

    # ── Payment failed ────────────────────────────────────────────────────
    def send_payment_failed_email(self, to_email: str, grace_end: datetime) -> bool:
        grace_str = grace_end.strftime("%B %d, %Y")
        body = f"""
<h1>Payment failed &#x26A0;&#xFE0F;</h1>
<p>We couldn't process your latest payment. Your account stays active during a
<span class="highlight">7-day grace period</span>.</p>
<div class="warn"><p>&#x23F3; &nbsp;Access ends on <strong>{grace_str}</strong> if not updated.</p></div>
<a href="https://app.agentshield.one/dashboard/settings" class="btn">Update Payment &#x2192;</a>
"""
        return self._send(to_email, "&#x26A0;&#xFE0F; AgentShield &mdash; Payment failed", body)

    # ── Downgrade ─────────────────────────────────────────────────────────
    def send_downgrade_email(self, to_email: str) -> bool:
        body = """
<h1>Subscription cancelled</h1>
<p>Your account is now on the <span class="badge">Free</span> plan.
Your historical data is preserved.</p>
<hr class="divider">
<a href="https://app.agentshield.one/dashboard/settings" class="btn">Resubscribe &#x2192;</a>
<p style="margin-top:16px;font-size:13px;color:#4a3d6b;">We'd love to know why &mdash; reply to this email.</p>
"""
        return self._send(to_email, "AgentShield subscription cancelled", body)

    # ── Weekly report ─────────────────────────────────────────────────────
    def send_weekly_report_email(
        self, to_email: str, org_name: str,
        total_cost: float, total_calls: int, active_agents: int,
        top_agent: str, top_agent_cost: float,
        anomaly_count: int, violation_count: int, week_label: str,
    ) -> bool:
        anomaly_txt = f"<span style='color:#f87171;font-weight:600;'>{anomaly_count} anomalies</span>" if anomaly_count else "<span style='color:#34d399;font-weight:600;'>No anomalies</span>"
        violation_txt = f"<span style='color:#f87171;font-weight:600;'>{violation_count} violations</span>" if violation_count else "<span style='color:#34d399;font-weight:600;'>No violations</span>"
        body = f"""
<h1>Weekly Report &mdash; {week_label}</h1>
<p>Activity summary for <span class="highlight">{org_name}</span>.</p>
<div class="stat-row">
  <div class="stat"><span class="stat-val">${total_cost:.2f}</span><span class="stat-lbl">Total Cost</span></div>
  <div class="stat"><span class="stat-val">{total_calls:,}</span><span class="stat-lbl">API Calls</span></div>
  <div class="stat"><span class="stat-val">{active_agents}</span><span class="stat-lbl">Active Agents</span></div>
</div>
<p>&#x1F3C6; &nbsp;<span class="highlight">Top agent:</span> {top_agent} &mdash; ${top_agent_cost:.2f}</p>
<p>{anomaly_txt} &nbsp;&middot;&nbsp; {violation_txt}</p>
<hr class="divider">
<a href="https://app.agentshield.one/dashboard/analytics" class="btn">View Analytics &#x2192;</a>
"""
        return self._send(to_email, f"&#x1F4CA; AgentShield Weekly Report &mdash; {week_label}", body)

    # ── Newsletter ────────────────────────────────────────────────────────
    def add_to_newsletter_list(self, email: str, first_name: str = "", list_id: int = 0) -> bool:
        payload: dict = {"email": email, "updateEnabled": True}
        if first_name:
            payload["attributes"] = {"FIRSTNAME": first_name}
        if list_id:
            payload["listIds"] = [list_id]
        try:
            return self._post("/contacts", payload)
        except Exception as exc:
            logger.error(f"[brevo] add_to_newsletter_list failed: {exc}")
            return False

    # ── Legacy alert methods (tasks_alerts.py compatibility) ──────────────
    def send_alert_email(
        self, to_email: str, agent_name: str, metric: str,
        current_value: float, threshold: float,
        smart_diagnosis: Optional[str] = None,
        suggested_fix: Optional[str] = None,
    ) -> bool:
        overage = current_value - threshold
        pct = round(overage / threshold * 100, 1) if threshold > 0 else 0
        diag = ""
        if smart_diagnosis:
            diag = f'<hr class="divider"><p><strong>&#x1F4A1; Diagnosis:</strong><br>{smart_diagnosis}</p><p><strong>Fix:</strong><br>{suggested_fix or "N/A"}</p>'
        body = f"""
<h1>Cost Alert &mdash; {agent_name}</h1>
<p>Agent <span class="highlight">{agent_name}</span> exceeded its {metric} threshold.</p>
<div class="stat-row">
  <div class="stat"><span class="stat-val">${current_value:.4f}</span><span class="stat-lbl">Current</span></div>
  <div class="stat"><span class="stat-val">${threshold:.4f}</span><span class="stat-lbl">Threshold</span></div>
  <div class="stat"><span class="stat-val">+{pct}%</span><span class="stat-lbl">Overage</span></div>
</div>
<a href="https://app.agentshield.one/dashboard/alerts" class="btn">View Alerts &#x2192;</a>{diag}
"""
        return self._send(to_email, f"&#x26A0;&#xFE0F; Cost Alert for '{agent_name}'", body)

    def send_anomaly_email(
        self, to_email: str, agent_name: str, metric: str,
        current_value: float, mean: float, stddev: float,
        multiplier: float, timestamp: str,
    ) -> bool:
        body = f"""
<h1>Anomaly &mdash; {agent_name} &#x1F534;</h1>
<div class="stat-row">
  <div class="stat"><span class="stat-val">{current_value:.4f}</span><span class="stat-lbl">{metric}</span></div>
  <div class="stat"><span class="stat-val">{multiplier:.1f}x</span><span class="stat-lbl">Above Normal</span></div>
  <div class="stat"><span class="stat-val">{mean:.4f}</span><span class="stat-lbl">Normal Mean</span></div>
</div>
<a href="https://app.agentshield.one/dashboard/agents" class="btn">Investigate &#x2192;</a>
"""
        return self._send(to_email, f"&#x1F534; Anomaly on '{agent_name}'", body)

    def send_budget_email(
        self, to_email: str, agent_name: str, period: str,
        max_usd: float, current_usd: float, percentage: float,
        exceeded: bool = False,
    ) -> bool:
        if exceeded:
            body = f"""
<h1>Budget Exceeded &mdash; {agent_name} &#x1F534;</h1>
<p>Agent <span class="highlight">{agent_name}</span> exceeded its {period} budget and is <strong>frozen</strong>.</p>
<div class="stat-row">
  <div class="stat"><span class="stat-val">${max_usd:.2f}</span><span class="stat-lbl">Budget</span></div>
  <div class="stat"><span class="stat-val">${current_usd:.2f}</span><span class="stat-lbl">Spent</span></div>
  <div class="stat"><span class="stat-val">&#x1F534;</span><span class="stat-lbl">Frozen</span></div>
</div>
<a href="https://app.agentshield.one/dashboard/budgets" class="btn">Manage Budget &#x2192;</a>
"""
            subj = f"&#x1F534; Budget exceeded for '{agent_name}'"
        else:
            body = f"""
<h1>Budget Warning &mdash; {agent_name}</h1>
<p>Agent <span class="highlight">{agent_name}</span> used <strong>{percentage:.0f}%</strong> of its {period} budget.</p>
<div class="stat-row">
  <div class="stat"><span class="stat-val">${max_usd:.2f}</span><span class="stat-lbl">Budget</span></div>
  <div class="stat"><span class="stat-val">${current_usd:.2f}</span><span class="stat-lbl">Spent</span></div>
  <div class="stat"><span class="stat-val">{percentage:.0f}%</span><span class="stat-lbl">Used</span></div>
</div>
<a href="https://app.agentshield.one/dashboard/budgets" class="btn">Manage Budget &#x2192;</a>
"""
            subj = f"&#x26A0;&#xFE0F; Budget at {percentage:.0f}% for '{agent_name}'"
        return self._send(to_email, subj, body)
