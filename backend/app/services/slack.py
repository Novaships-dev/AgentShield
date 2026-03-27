"""Slack incoming webhook notification service."""
from __future__ import annotations
import json
import logging
import urllib.request
import urllib.error
from typing import Optional

logger = logging.getLogger(__name__)

DASHBOARD_URL = "https://app.agentshield.io/dashboard"


class SlackService:
    def _post(self, webhook_url: str, payload: dict) -> bool:
        """POST Block Kit payload to a Slack incoming webhook."""
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status == 200
        except urllib.error.HTTPError as exc:
            logger.error(f"[slack] HTTP {exc.code}: {exc.read().decode()}")
            raise
        except Exception as exc:
            logger.error(f"[slack] request failed: {exc}")
            raise

    def send_alert(
        self,
        webhook_url: str,
        agent_name: str,
        metric: str,
        current_value: float,
        threshold: float,
    ) -> bool:
        overage_pct = round((current_value - threshold) / threshold * 100, 1) if threshold > 0 else 0
        payload = {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"⚠️ *Cost Alert* — {agent_name}\nCurrent: *${current_value:.4f}* | Threshold: ${threshold:.4f} | Overage: +{overage_pct}%",
                    },
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "View in Dashboard"},
                            "url": f"{DASHBOARD_URL}/alerts",
                        }
                    ],
                },
            ]
        }
        return self._post(webhook_url, payload)

    def send_anomaly(
        self,
        webhook_url: str,
        agent_name: str,
        metric: str,
        current_value: float,
        mean: float,
        stddev: float,
        multiplier: float,
        day_time: str,
    ) -> bool:
        payload = {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            f"🔴 *Anomaly Detected* — {agent_name}\n"
                            f"{metric}: *{current_value:.4f}* (normal: ~{mean:.4f} ±{stddev:.4f})\n"
                            f"This is *{multiplier:.1f}x* above normal for {day_time}."
                        ),
                    },
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "Investigate"},
                            "url": f"{DASHBOARD_URL}/agents",
                        }
                    ],
                },
            ]
        }
        return self._post(webhook_url, payload)

    def send_budget_exceeded(
        self,
        webhook_url: str,
        agent_name: str,
        current_usd: float,
        max_usd: float,
        period: str,
    ) -> bool:
        payload = {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            f"🔴 *Budget Exceeded* — {agent_name}\n"
                            f"${current_usd:.2f}/${max_usd:.2f} ({period}) — *Agent frozen*"
                        ),
                    },
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "Manage Budget"},
                            "url": f"{DASHBOARD_URL}/budgets",
                        }
                    ],
                },
            ]
        }
        return self._post(webhook_url, payload)
