# SKILL-NEXTJS.md — Comment coder le frontend Next.js dans AgentShield

> Lire AVANT de créer ou modifier un composant, une page, ou un hook frontend.
> Réfs : CONVENTIONS.md, UI.md, COPY.md

---

## APP ROUTER — STRUCTURE

```
src/app/
├── layout.tsx              ← Root layout (dark mode, fonts, providers)
├── page.tsx                ← Landing page
├── (auth)/                 ← Route group sans layout dashboard
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (onboarding)/
│   └── setup/page.tsx
├── (dashboard)/
│   ├── layout.tsx          ← Dashboard layout (sidebar, topnav, WebSocket provider)
│   └── dashboard/
│       ├── page.tsx        ← Main dashboard
│       ├── agents/page.tsx
│       └── ...
├── share/
│   └── [token]/page.tsx   ← Public replay (pas de dashboard layout)
└── docs/
    └── page.tsx
```

## SERVER VS CLIENT COMPONENTS

```
SERVER COMPONENT (défaut — PAS de "use client") :
  → Pages qui fetch des données au load
  → Layouts
  → Composants statiques
  → SEO-critical (landing page sections)

CLIENT COMPONENT ("use client") :
  → useState, useEffect, useRef
  → onClick, onChange, onSubmit
  → WebSocket (useWebSocket hook)
  → Charts (Recharts)
  → Animations (GSAP, Three.js)
  → Interactivité (drag-and-drop, modals, dropdowns)

RÈGLE : si tu peux faire sans "use client", fais sans.
```

## PATTERN PAGE

```typescript
// Server Component page
// src/app/(dashboard)/dashboard/agents/page.tsx

import { AgentTable } from "@/components/dashboard/AgentTable";
import { getAgents } from "@/lib/api.server";

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">Agents</h1>
      </div>
      <AgentTable initialData={agents} />
    </div>
  );
}
```

## PATTERN COMPOSANT CLIENT

```typescript
// src/components/dashboard/AgentTable.tsx

"use client";

import { useState } from "react";
import { useAgents } from "@/hooks/useAgents";
import type { Agent } from "@/types/agent";

interface AgentTableProps {
  initialData?: Agent[];
}

export function AgentTable({ initialData }: AgentTableProps) {
  const { agents, isLoading } = useAgents(initialData);
  const [sortBy, setSortBy] = useState<string>("cost_month");

  if (isLoading) return <AgentTableSkeleton />;

  return (
    // JSX avec Tailwind — dark mode, glassmorphism
  );
}
```

## PATTERN HOOK

```typescript
// src/hooks/useAgents.ts

"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Agent } from "@/types/agent";

export function useAgents(initialData?: Agent[]) {
  const [agents, setAgents] = useState<Agent[]>(initialData || []);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial si pas de SSR data
  useEffect(() => {
    if (!initialData) {
      api.agents.list()
        .then(setAgents)
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [initialData]);

  // WebSocket live updates
  useWebSocket("new_event", (data) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.name === data.agent ? { ...a, cost_today_usd: a.cost_today_usd + data.cost_usd } : a
      )
    );
  });

  return { agents, isLoading, error, refetch: () => { /* ... */ } };
}
```

## STYLING — RÈGLES

```
1. Tailwind UNIQUEMENT (pas de CSS modules, pas de styled-components)
2. CSS variables pour les couleurs (var(--accent), var(--surface-1), etc.)
3. Glassmorphism : utiliser le composant GlassCard
4. Border-radius : rounded-2xl (16px) pour les cards, rounded-xl (12px) pour les inputs
5. Spacing : space-y-6 entre les sections, gap-4/gap-5 dans les grids
6. Responsive : mobile-first, utiliser sm: md: lg: breakpoints
7. Hover effects : transition-all duration-300
8. Dark mode : pas de classes dark: — on est TOUJOURS en dark mode
9. Fonts : font-display pour les titres, font-body pour le texte, font-mono pour les données
```

## IMPORTS — ORDRE

```typescript
// 1. React/Next
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

// 2. Libraries
import { BarChart, XAxis, YAxis } from "recharts";
import { Shield, AlertTriangle } from "lucide-react";

// 3. shadcn/ui
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// 4. Local components
import { GlassCard } from "@/components/ui/GlassCard";
import { GlowButton } from "@/components/ui/GlowButton";

// 5. Hooks
import { useAgents } from "@/hooks/useAgents";

// 6. Lib/utils
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

// 7. Types
import type { Agent } from "@/types/agent";
```

## SKELETON LOADING — PATTERN

```typescript
// Chaque composant qui fetch des données a un skeleton

function AgentTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
      ))}
    </div>
  );
}
```

## CE QU'ON NE FAIT JAMAIS

```
1. Pas de CSS inline (sauf CSS variables dynamiques)
2. Pas de !important
3. Pas de localStorage (pas supporté dans les artifacts Claude)
4. Pas de dangerouslySetInnerHTML (sauf DOMPurify)
5. Pas de console.log en production (utiliser un logger)
6. Pas d'images non-optimisées (toujours next/image)
7. Pas de fetch dans useEffect sans cleanup (AbortController)
8. Pas de secrets dans les composants client (NEXT_PUBLIC_ only)
```
