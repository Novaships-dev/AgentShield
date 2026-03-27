"""Brevo (formerly Sendinblue) email notification service."""
from __future__ import annotations
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SENDER_EMAIL = "alerts@agentshield.one"
SENDER_NAME = "AgentShield"


class BrevoService:
    def __init__(self):
        from app.config import settings
        self._api_key = getattr(settings, "brevo_api_key", "")
        self._base_url = "https://api.brevo.com/v3"

    def _post(self, endpoint: str, payload: dict) -> bool:
        """Send a POST request to the Brevo API."""
        import json
        import urllib.request
        import urllib.error

        if not self._api_key:
            logger.warning("[brevo] BREVO_API_KEY not configured — email skipped")
            return False

        url = f"{self._base_url}{endpoint}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "api-key": self._api_key,
            },
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

    def send_alert_email(
        self,
        to_email: str,
        agent_name: str,
        metric: str,
        current_value: float,
        threshold: float,
        smart_diagnosis: Optional[str] = None,
        suggested_fix: Optional[str] = None,
    ) -> bool:
        overage = current_value - threshold
        pct = round(overage / threshold * 100, 1) if threshold > 0 else 0

        subject = f"⚠️ AgentShield — Cost Alert for '{agent_name}'"

        html_body = f"""
<p>Your agent '<strong>{agent_name}</strong>' has exceeded your {metric} threshold.</p>
<p>
  <strong>Current:</strong> ${current_value:.4f}<br>
  <strong>Threshold:</strong> ${threshold:.4f}<br>
  <strong>Overage:</strong> ${overage:.4f} (+{pct}%)
</p>
<p><a href="https://app.agentshield.one/dashboard/alerts">View in Dashboard →</a></p>
"""
        if smart_diagnosis:
            html_body += f"""
<hr>
<p><strong>💡 AI Diagnosis:</strong><br>{smart_diagnosis}</p>
<p><strong>Suggested fix:</strong><br>{suggested_fix or "No suggestion available."}</p>
<p><a href="https://app.agentshield.one/dashboard/agents">Open Replay for this agent →</a></p>
"""

        payload = {
            "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_body,
        }
        return self._post("/smtp/email", payload)

    def send_anomaly_email(
        self,
        to_email: str,
        agent_name: str,
        metric: str,
        current_value: float,
        mean: float,
        stddev: float,
        multiplier: float,
        timestamp: str,
    ) -> bool:
        subject = f"🔴 AgentShield — Anomaly detected on '{agent_name}'"
        html_body = f"""
<p>Unusual activity detected on '<strong>{agent_name}</strong>'.</p>
<p>
  <strong>Metric:</strong> {metric}<br>
  <strong>Current value:</strong> {current_value:.4f} ({multiplier:.1f}x above normal)<br>
  <strong>Normal range:</strong> {mean:.4f} ± {stddev:.4f}<br>
  <strong>Time:</strong> {timestamp}
</p>
<p><strong>Possible causes:</strong></p>
<ul>
  <li>Agent looping on an edge case</li>
  <li>Unexpected traffic spike</li>
  <li>Prompt change causing longer outputs</li>
</ul>
<p><a href="https://app.agentshield.one/dashboard/agents">Investigate in Dashboard →</a></p>
"""
        payload = {
            "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_body,
        }
        return self._post("/smtp/email", payload)

    def send_budget_email(
        self,
        to_email: str,
        agent_name: str,
        period: str,
        max_usd: float,
        current_usd: float,
        percentage: float,
        exceeded: bool = False,
    ) -> bool:
        if exceeded:
            subject = f"🔴 AgentShield — Budget exceeded for '{agent_name}' — Agent frozen"
            html_body = f"""
<p>Your agent '<strong>{agent_name}</strong>' has exceeded its {period} budget.</p>
<p>
  <strong>Budget:</strong> ${max_usd:.2f}/month<br>
  <strong>Current:</strong> ${current_usd:.2f}<br>
  <strong>Status:</strong> 🔴 Frozen (kill switch activated)
</p>
<p><strong>What to do:</strong></p>
<ul>
  <li>Increase the budget cap</li>
  <li>Optimize the agent (check Cost Autopilot recommendations)</li>
  <li>Deactivate the kill switch manually</li>
</ul>
<p><a href="https://app.agentshield.one/dashboard/budgets">Manage Budget →</a></p>
"""
        else:
            subject = f"⚠️ AgentShield — Budget warning for '{agent_name}' ({percentage:.0f}%)"
            html_body = f"""
<p>Your agent '<strong>{agent_name}</strong>' has used {percentage:.0f}% of its {period} budget.</p>
<p>
  <strong>Budget:</strong> ${max_usd:.2f}<br>
  <strong>Current:</strong> ${current_usd:.2f}
</p>
<p><a href="https://app.agentshield.one/dashboard/budgets">Manage Budget →</a></p>
"""
        payload = {
            "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_body,
        }
        return self._post("/smtp/email", payload)
