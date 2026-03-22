# SKILL-DASHBOARD.md — Comment construire les composants dashboard

> Lire AVANT de créer un composant dashboard, un chart, ou un widget.
> Réfs : UI.md, SPEC.md (sections 1-2), COPY.md

---

## COMPOSANTS CORE

```
StatsCards     → 4 KPI cards (Today, Month, Projected, Active Agents)
CostOverTime   → Line chart temps réel (Recharts, type="monotone")
CostByAgent    → Horizontal bar chart (top agents)
CostByProvider → Donut/pie chart (OpenAI/Anthropic/Google)
CostByModel    → Horizontal bar chart (gpt-4o, claude-sonnet, etc.)
AgentTable     → Table avec sort, filter, status badges
AlertBanner    → Banner fixe en haut si alerte active
ForecastBanner → "Projected: $847 by end of month"
RecommendationCard → Suggestion Cost Autopilot
SmartAlertCard → Diagnostic IA avec lien Replay
BudgetGauge    → Barre de progression avec couleurs (vert/orange/rouge)
AnomalyAlert   → Card notification spike détecté
```

## RECHARTS — PATTERN

```typescript
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area } from "recharts";

function CostOverTime({ data }: { data: TimeseriesPoint[] }) {
  return (
    <GlassCard>
      <h3 className="text-sm text-white/40 uppercase tracking-wider mb-4">Cost Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis
            dataKey="timestamp"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
            stroke="rgba(255,255,255,0.04)"
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
            stroke="rgba(255,255,255,0.04)"
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area dataKey="cost_usd" fill="url(#costGradient)" stroke="none" />
          <Line
            dataKey="cost_usd"
            stroke="#7C3AED"
            strokeWidth={2}
            dot={false}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
```

## LIVE UPDATES VIA WEBSOCKET

```typescript
// Le dashboard se connecte au WS au mount du layout
// Chaque composant écoute les events pertinents

function StatsCards() {
  const [costToday, setCostToday] = useState(0);

  useWebSocket("new_event", (data) => {
    setCostToday((prev) => prev + data.cost_usd);
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard label="Today" value={`$${costToday.toFixed(2)}`} />
      ...
    </div>
  );
}
```

## EMPTY STATES

```
Chaque composant qui affiche des données a un empty state :
  → Icône + Titre + Description + CTA
  → Voir COPY.md section 3 pour les textes exacts
  → Utiliser le composant EmptyState partagé
```

## RESPONSIVE

```
Desktop  : grid multi-colonnes, sidebar visible
Tablet   : sidebar collapsed (icons), tables scroll horizontal
Mobile   : bottom nav, cards stackées, charts full-width réduits
```
