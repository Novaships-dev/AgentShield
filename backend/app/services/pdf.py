"""PDF report generation service using ReportLab."""
from __future__ import annotations
import logging
import os
import tempfile
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Report storage directory — temp for 7 days
REPORTS_DIR = os.environ.get("REPORTS_DIR", "/tmp/agentshield_reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

# Colors (dark theme)
BG_COLOR = (0.07, 0.07, 0.10)       # #121218
SURFACE_COLOR = (0.11, 0.11, 0.15)  # #1C1C26
ACCENT_COLOR = (0.49, 0.23, 0.93)   # #7C3AED
TEXT_PRIMARY = (1, 1, 1)
TEXT_SECONDARY = (0.7, 0.7, 0.8)
TEXT_MUTED = (0.45, 0.45, 0.55)
GREEN = (0.27, 0.87, 0.5)


def generate_report(
    org_id: str,
    org_name: str,
    period_start: str,
    period_end: str,
    report_id: str,
    db,
) -> str:
    """Generate a PDF report. Returns the file path."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
        from reportlab.lib import colors
    except ImportError:
        raise RuntimeError("reportlab is not installed. Add reportlab>=4.0.0 to dependencies.")

    # Collect data
    data = _collect_data(org_id, period_start, period_end, db)

    filename = f"report_{org_id[:8]}_{report_id[:8]}.pdf"
    filepath = os.path.join(REPORTS_DIR, filename)

    page_w, page_h = A4
    c = canvas.Canvas(filepath, pagesize=A4)

    def rgb(t): return colors.Color(*t)

    def draw_page_bg():
        c.setFillColor(rgb(BG_COLOR))
        c.rect(0, 0, page_w, page_h, fill=1, stroke=0)

    def heading(text, x, y, size=14, color=TEXT_PRIMARY):
        c.setFillColor(rgb(color))
        c.setFont("Helvetica-Bold", size)
        c.drawString(x, y, text)

    def body(text, x, y, size=9, color=TEXT_SECONDARY):
        c.setFillColor(rgb(color))
        c.setFont("Helvetica", size)
        c.drawString(x, y, text)

    def line(x1, y1, x2, y2, color=SURFACE_COLOR):
        c.setStrokeColor(rgb(color))
        c.setLineWidth(0.5)
        c.line(x1, y1, x2, y2)

    def card(x, y, w, h):
        c.setFillColor(rgb(SURFACE_COLOR))
        c.roundRect(x, y, w, h, 4, fill=1, stroke=0)

    # ─── Page 1 ────────────────────────────────────────────────────────
    draw_page_bg()

    # Header bar
    c.setFillColor(rgb(ACCENT_COLOR))
    c.rect(0, page_h - 60, page_w, 60, fill=1, stroke=0)
    c.setFillColor(rgb(TEXT_PRIMARY))
    c.setFont("Helvetica-Bold", 18)
    c.drawString(20*mm, page_h - 38, "AgentShield")
    c.setFont("Helvetica", 10)
    c.drawRightString(page_w - 20*mm, page_h - 28, f"{org_name}")
    c.drawRightString(page_w - 20*mm, page_h - 40, f"{period_start} → {period_end}")

    # Executive Summary
    y = page_h - 90
    heading("Executive Summary", 20*mm, y, 14, ACCENT_COLOR)
    y -= 20

    kpis = [
        ("Total Cost", f"${data['total_cost']:.2f}"),
        ("Total Requests", f"{data['total_requests']:,}"),
        ("Active Agents", str(data['active_agents'])),
        ("Total Sessions", str(data['total_sessions'])),
    ]
    col_w = (page_w - 40*mm) / len(kpis)
    for i, (label, val) in enumerate(kpis):
        x = 20*mm + i * col_w
        card(x, y - 36, col_w - 5, 42)
        body(label, x + 8, y - 14, 8, TEXT_MUTED)
        heading(val, x + 8, y - 28, 13, TEXT_PRIMARY)
    y -= 55

    # Agent cost breakdown
    heading("Cost by Agent", 20*mm, y, 12, ACCENT_COLOR)
    y -= 14
    agents = data["agents"][:10]
    max_cost = max((a["cost"] for a in agents), default=1)
    for agent in agents:
        pct = agent["cost"] / max_cost if max_cost else 0
        bar_w = (page_w - 80*mm) * pct
        body(agent["name"][:28], 20*mm, y - 3, 9, TEXT_SECONDARY)
        c.setFillColor(rgb(ACCENT_COLOR))
        c.rect(70*mm, y - 1, bar_w, 8, fill=1, stroke=0)
        body(f"${agent['cost']:.4f}", page_w - 40*mm, y - 3, 9, TEXT_PRIMARY)
        y -= 14
        if y < 40*mm:
            break

    # Provider breakdown
    if y > 80:
        heading("Cost by Provider/Model", 20*mm, y - 10, 12, ACCENT_COLOR)
        y -= 24
        for model, cost in list(data["by_model"].items())[:6]:
            body(f"{model}", 20*mm, y - 3, 8, TEXT_SECONDARY)
            body(f"${cost:.4f}", 80*mm, y - 3, 8, TEXT_PRIMARY)
            y -= 12

    # Footer
    c.setFillColor(rgb(TEXT_MUTED))
    c.setFont("Helvetica", 7)
    c.drawString(20*mm, 15, f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} | AgentShield")
    c.drawRightString(page_w - 20*mm, 15, "Page 1")

    c.showPage()

    # ─── Page 2 ────────────────────────────────────────────────────────
    draw_page_bg()
    y = page_h - 40

    # Top 5 sessions
    heading("Top 5 Costliest Sessions", 20*mm, y, 12, ACCENT_COLOR)
    y -= 16
    sessions = data["top_sessions"][:5]
    for sess in sessions:
        card(20*mm, y - 26, page_w - 40*mm, 28)
        body(f"Session: {sess['session_id']}", 25*mm, y - 10, 8, TEXT_SECONDARY)
        body(f"${sess['cost']:.4f}", page_w - 50*mm, y - 10, 9, TEXT_PRIMARY)
        body(f"{sess['steps']} steps · {sess.get('status', 'success')}", 25*mm, y - 20, 7, TEXT_MUTED)
        y -= 35

    y -= 10
    heading("Violations Summary", 20*mm, y, 12, ACCENT_COLOR)
    y -= 16
    if data["violations"]:
        for v in data["violations"][:5]:
            body(f"• {v['rule_name']}: {v['count']} violations", 20*mm, y, 8, TEXT_SECONDARY)
            y -= 12
    else:
        body("No violations in this period.", 20*mm, y, 8, TEXT_MUTED)
        y -= 12

    y -= 10
    heading("Forecast", 20*mm, y, 12, ACCENT_COLOR)
    y -= 14
    body(f"Projected end-of-month cost: ${data['forecast_eom']:.2f}", 20*mm, y, 9, TEXT_PRIMARY)

    # Footer page 2
    c.setFillColor(rgb(TEXT_MUTED))
    c.setFont("Helvetica", 7)
    c.drawString(20*mm, 15, f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} | AgentShield")
    c.drawRightString(page_w - 20*mm, 15, "Page 2")

    c.showPage()
    c.save()

    return filepath


def _collect_data(org_id: str, period_start: str, period_end: str, db) -> dict:
    """Collect all data needed for the report."""
    data: dict = {
        "total_cost": 0.0,
        "total_requests": 0,
        "active_agents": 0,
        "total_sessions": 0,
        "agents": [],
        "by_model": {},
        "top_sessions": [],
        "violations": [],
        "forecast_eom": 0.0,
    }

    try:
        events = (
            db.table("events")
            .select("cost_usd, agent_id, model, session_id")
            .eq("organization_id", org_id)
            .gte("tracked_at", period_start)
            .lte("tracked_at", period_end)
            .execute()
        )
        rows = events.data or []

        agent_costs: dict[str, float] = {}
        model_costs: dict[str, float] = {}
        session_costs: dict[str, dict] = {}

        for row in rows:
            cost = float(row.get("cost_usd") or 0)
            data["total_cost"] += cost
            data["total_requests"] += 1

            agent_id = row.get("agent_id") or "unknown"
            agent_costs[agent_id] = agent_costs.get(agent_id, 0) + cost

            model = row.get("model") or "unknown"
            model_costs[model] = model_costs.get(model, 0) + cost

            sess_id = row.get("session_id") or "no-session"
            if sess_id not in session_costs:
                session_costs[sess_id] = {"session_id": sess_id, "cost": 0.0, "steps": 0}
            session_costs[sess_id]["cost"] += cost
            session_costs[sess_id]["steps"] += 1

        # Resolve agent names
        agent_ids = list(agent_costs.keys())
        agent_name_map: dict[str, str] = {}
        if agent_ids:
            ag_res = db.table("agents").select("id, name").in_("id", agent_ids).execute()
            agent_name_map = {a["id"]: a["name"] for a in (ag_res.data or [])}

        data["agents"] = sorted(
            [{"name": agent_name_map.get(k, k[:16]), "cost": v} for k, v in agent_costs.items()],
            key=lambda x: x["cost"], reverse=True
        )
        data["active_agents"] = len(agent_costs)
        data["by_model"] = dict(sorted(model_costs.items(), key=lambda x: x[1], reverse=True))
        data["total_sessions"] = len(session_costs)
        data["top_sessions"] = sorted(session_costs.values(), key=lambda x: x["cost"], reverse=True)[:5]

        # Violations
        viol = (
            db.table("guardrail_violations")
            .select("guardrail_rule_id", count="exact")
            .eq("organization_id", org_id)
            .gte("created_at", period_start)
            .lte("created_at", period_end)
            .execute()
        )
        data["violations"] = []  # Simplified — would group by rule

        # Forecast
        data["forecast_eom"] = data["total_cost"] * 1.1  # Simplified estimate

    except Exception as exc:
        logger.error(f"[pdf] data collection error: {exc}")

    return data
