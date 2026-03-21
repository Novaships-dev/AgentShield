# UI.md — Design System AgentShield

> Ce fichier définit l'identité visuelle, les composants, les layouts, et les règles de design du projet. Claude Code le lit avant de créer ou modifier un composant frontend.
> Cohérent avec : SPEC.md (features UI), CONVENTIONS.md (naming TS/React), CONTEXT.md (identité Nova)
> Dernière mise à jour : mars 2026

---

## 1. IDENTITÉ VISUELLE

### Couleurs

```
── Primaires ──────────────────────────────────────
Accent (violet)     : #7C3AED    → CTA, liens, éléments actifs
Accent2 (cyan)      : #06B6D4    → Accents secondaires, succès
Accent3 (amber)     : #F59E0B    → Warnings, highlights

── Glow ───────────────────────────────────────────
Glow (violet clair) : #A78BFA    → Halos, ombres, glow effects

── Backgrounds ────────────────────────────────────
Dark                : #030014    → Background principal (landing)
Surface 0           : #0A0A0F    → Background app (dashboard)
Surface 1           : rgba(255,255,255,0.03)  → Cards, panels
Surface 2           : rgba(255,255,255,0.06)  → Cards hover, inputs
Surface 3           : rgba(255,255,255,0.10)  → Éléments actifs, selected

── Texte ──────────────────────────────────────────
Text primary        : #FFFFFF    → Titres, données importantes
Text secondary      : rgba(255,255,255,0.70)  → Corps de texte
Text tertiary       : rgba(255,255,255,0.45)  → Labels, descriptions
Text muted          : rgba(255,255,255,0.25)  → Placeholders, disabled
Text link           : #7C3AED    → Liens (même que accent)

── Borders ────────────────────────────────────────
Border default      : rgba(255,255,255,0.06)  → Contours de cards
Border hover        : rgba(124,58,237,0.30)   → Contours hover
Border focus        : rgba(124,58,237,0.50)    → Contours focus

── Sémantiques ────────────────────────────────────
Success             : #22C55E    → Confirmations, statut OK
Warning             : #F59E0B    → Alertes, budget > 80%
Error               : #EF4444    → Erreurs, frozen, violations
Info                : #06B6D4    → Informations, tips
```

### CSS Variables

```css
:root {
  --accent: #7C3AED;
  --accent2: #06B6D4;
  --accent3: #F59E0B;
  --glow: #A78BFA;
  --dark: #030014;
  --surface-0: #0A0A0F;
  --surface-1: rgba(255,255,255,0.03);
  --surface-2: rgba(255,255,255,0.06);
  --success: #22C55E;
  --warning: #F59E0B;
  --error: #EF4444;
  --info: #06B6D4;
}
```

### Typographie

```
── Fonts ──────────────────────────────────────────
Display (titres)   : Inter, system-ui, sans-serif — weight 800
Body (texte)       : Inter, system-ui, sans-serif — weight 400/500
Mono (code, data)  : JetBrains Mono, Fira Code, monospace — weight 400

── Tailles ────────────────────────────────────────
Hero title    : clamp(3rem, 7.5vw, 5.8rem) — tracking -0.05em
Section title : clamp(2rem, 4.5vw, 3.4rem) — tracking -0.04em
Card title    : 1.25rem (20px) — weight 700
Body          : 0.875rem (14px) — leading 1.6
Small         : 0.78rem (12.5px)
Tiny          : 0.72rem (11.5px) — labels, badges
Mono data     : 0.875rem (14px) — dans les tables et KPI
```

### Mode

```
DARK MODE EXCLUSIVEMENT.
Pas de light mode. Pas de toggle. Jamais.
Le background est toujours sombre (#030014 ou #0A0A0F).
```

---

## 2. GLASSMORPHISM — DESIGN LANGUAGE

### GlassCard (composant de base)

```
Chaque panel, card, et container utilise le style glassmorphism :

Background  : linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))
Backdrop    : blur(24px) saturate(1.6)
Border      : 1px solid rgba(255,255,255,0.06)
Border-radius: 24px (1.5rem)
Shadow      : 0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)

Hover :
  Background  : linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06), rgba(124,58,237,0.04))
  Border      : animated gradient (accent → accent2 → accent3)
  Shadow      : 0 20px 60px rgba(124,58,237,0.15), 0 0 40px rgba(124,58,237,0.08)
  Transform   : translateY(-4px)
```

### Gradient border animé

```css
.gradient-border::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;
  background: linear-gradient(135deg, var(--accent), var(--accent2), var(--accent3), var(--accent));
  background-size: 300% 300%;
  animation: gradientSpin 4s linear infinite;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

### Text gradient

```css
.text-gradient {
  background: linear-gradient(135deg, var(--accent), var(--glow), var(--accent2), var(--accent3));
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## 3. COMPOSANTS UI

### Boutons

```
GlowButton (primary) :
  Background: linear-gradient(135deg, var(--accent), var(--glow))
  Shadow: 0 0 45px rgba(124,58,237,0.35)
  Hover: scale(1.05), shadow intensifié
  Text: white, bold, 14px

GlowButton (secondary) :
  Background: rgba(255,255,255,0.04)
  Border: 1px solid rgba(255,255,255,0.10)
  Hover: background 0.08, border 0.20
  Text: white/70, semibold, 14px

Danger button :
  Background: transparent
  Border: 1px solid var(--error)/30
  Text: var(--error)
  Hover: background error/10
```

### Inputs

```
Background  : rgba(255,255,255,0.04)
Border      : 1px solid rgba(255,255,255,0.08)
Border-radius: 12px
Padding     : 12px 16px
Font        : 14px, Inter
Color       : white
Placeholder : rgba(255,255,255,0.25)

Focus :
  Border: 1px solid rgba(124,58,237,0.50)
  Shadow: 0 0 0 3px rgba(124,58,237,0.15)

Error :
  Border: 1px solid var(--error)/50
  Shadow: 0 0 0 3px rgba(239,68,68,0.15)
```

### Tags / Badges

```
Background  : {color}/15
Border      : 1px solid {color}/25
Border-radius: 8px
Padding     : 2px 10px
Font        : 11px, uppercase, tracking 0.08em, weight 600
Color       : {color}

Module badges :
  Monitor : accent (#7C3AED)
  Replay  : accent2 (#06B6D4)
  Protect : accent3 (#F59E0B)

Status badges :
  Active   : success (#22C55E)
  Warning  : warning (#F59E0B)
  Frozen   : error (#EF4444)
  Inactive : muted (white/25)
```

### Tables

```
Header  : text white/40, 11px uppercase tracking 0.08em, border-bottom white/06
Row     : text white/70, 14px, padding 12px 16px
Row hover: background white/03
Row alt : pas de zebra striping (trop daté)
Borders : bottom only, white/04
Sort    : icon ▲▼ à côté du header, accent color quand actif
```

### Graphiques (Recharts)

```
Background  : transparent (dans une GlassCard)
Grid lines  : rgba(255,255,255,0.04)
Axis labels : rgba(255,255,255,0.30), 11px
Tooltip     : glass style (backdrop-blur, border white/10)
Colors (séries) :
  Serie 1 : #7C3AED (accent)
  Serie 2 : #06B6D4 (accent2)
  Serie 3 : #F59E0B (accent3)
  Serie 4 : #A78BFA (glow)
  Serie 5 : #22C55E (success)
Area fill   : gradient vertical, couleur/20 → transparent
Line        : 2px, smooth (type="monotone")
Dots        : 4px, même couleur que la ligne, glow on hover
```

---

## 4. LAYOUTS

### Landing page

```
┌──────────────────────────────────────────────────┐
│ Navbar (fixed, glass, z-50)                      │
│ Logo — Links — [Login] [CTA]                     │
├──────────────────────────────────────────────────┤
│ Hero (full viewport, 3D scene background)        │
│ Badge — Title — Subtitle — CTAs                  │
├──────────────────────────────────────────────────┤
│ Logos bar                                        │
├──────────────────────────────────────────────────┤
│ Stats bar (GlassCard)                            │
├──────────────────────────────────────────────────┤
│ Module cards (3 cards : Monitor/Replay/Protect)  │
├──────────────────────────────────────────────────┤
│ Bento features (grid 6 colonnes)                 │
├──────────────────────────────────────────────────┤
│ How it works (3 steps)                           │
├──────────────────────────────────────────────────┤
│ Code preview (terminal)                          │
├──────────────────────────────────────────────────┤
│ Pricing (3-4 cards)                              │
├──────────────────────────────────────────────────┤
│ Final CTA (GlassCard gradient-border)            │
├──────────────────────────────────────────────────┤
│ Footer                                           │
└──────────────────────────────────────────────────┘

Max width : 1100px pour le contenu
Padding horizontal : 32px (8 sur mobile)
Sections spacing : 80px vertical
```

### Dashboard

```
┌──────────────────────────────────────────────────┐
│ TopNav (fixed, h-14, glass)                      │
│ Logo — Search — Alerts bell — Settings — Avatar  │
├───────┬──────────────────────────────────────────┤
│       │                                          │
│ Side  │  Content area                            │
│ bar   │  (scrollable, padding 24px)              │
│       │                                          │
│ w-60  │  Max width : 1200px                      │
│ fixed │  Background : var(--surface-0)           │
│       │                                          │
│ ───── │                                          │
│ MONITOR│                                         │
│ Dash   │                                         │
│ Agents │                                         │
│ Alerts │                                         │
│ Budget │                                         │
│ Forcast│                                         │
│ Reports│                                         │
│ Team   │                                         │
│ ───── │                                          │
│ REPLAY│                                          │
│ Session│                                         │
│ ───── │                                          │
│ PROTECT│                                         │
│ Guards │                                         │
│ PII    │                                         │
│ Violat.│                                         │
│ ───── │                                          │
│ Audit  │                                         │
│ Settings│                                        │
└───────┴──────────────────────────────────────────┘

Sidebar :
  Width: 240px (w-60)
  Background: transparent (même que surface-0)
  Border-right: 1px solid white/04
  Items: 14px, padding 8px 16px, border-radius 8px
  Active: background accent/10, text white, left border 2px accent
  Hover: background white/04
  Sections: labels uppercase 11px white/25, margin-top 24px
  Module badge: petit dot coloré à côté du label de section

Mobile :
  Sidebar → bottom nav (5 items max) + hamburger pour le reste
  Content : full width, padding 16px
```

### Replay timeline

```
┌──────────────────────────────────────────────────┐
│ Session header                                   │
│ ID — Status badge — Cost — Duration — Steps      │
│ [Share] [Compare] [Export]                        │
├──────────────────────────────────────────────────┤
│ Timeline bar (horizontal, scrollable)            │
│ ●━━━━●━━━━●━━━━●━━━━●━━━━●━━━━●                │
│ 1    2    3    4    5    6    7                   │
│ classify  retrieve  respond  ...                 │
│ $0.001   $0.018   $0.180  ...                    │
├──────────────────────────────────────────────────┤
│ Step detail (selected step)                      │
│ ┌────────────────────┬─────────────────────────┐ │
│ │ INPUT              │ OUTPUT                  │ │
│ │ (code-formatted,   │ (code-formatted,        │ │
│ │  scrollable,       │  scrollable,            │ │
│ │  PII highlighted)  │  PII highlighted)       │ │
│ └────────────────────┴─────────────────────────┘ │
│ Badges: cost — tokens — duration — model — PII  │
│ Violations: [if any]                             │
│ Autopilot: [suggestion if available]             │
└──────────────────────────────────────────────────┘

Timeline dots :
  Default: 12px, white/20 background, white/10 border
  Hover: 14px, accent/30 background, glow
  Selected: 14px, accent background, glow shadow
  Error: error color
  With violation: orange ring
  Running (last step): pulse animation

Connecting lines :
  Default: 2px, white/08
  Between selected: 2px, accent/30
  Width proportionnelle à la durée (optionnel)
```

---

## 5. ANIMATIONS

```
── Transitions globales ───────────────────────────
Durée standard    : 300ms
Durée hover       : 200ms
Durée page        : 400ms
Easing            : ease-out (hover), ease-in-out (page)

── Reveal (scroll) ────────────────────────────────
Les sections apparaissent au scroll avec :
  opacity: 0 → 1
  translateY: 30px → 0
  Durée: 600ms
  Easing: cubic-bezier(0.16, 1, 0.3, 1)
  Delay: +60ms par élément dans un groupe

── Live data ──────────────────────────────────────
Nouveau event dans le feed :
  slideInFromTop, 300ms
  Highlight background accent/10 pendant 2s puis fade

KPI counter update :
  Smooth increment (counting animation, 500ms)

── Loading states ─────────────────────────────────
Skeleton : rectangular blocks, background shimmer
  gradient animation left→right, 1.5s, infinite
  Color: white/04 → white/08 → white/04

Spinner : pas de spinner classique
  3 dots pulsing (accent color), opacity animation

── 3D Hero (landing) ──────────────────────────────
Morphing icosahedron : continuous, 0.08 rotation/frame
Particles : 600 points, additive blending, drift
Orbital rings : 3 rings, different speeds
Camera follow mouse : lerp 0.015
```

---

## 6. RESPONSIVE

### Breakpoints (Tailwind)

```
sm  : 640px
md  : 768px
lg  : 1024px
xl  : 1280px
2xl : 1536px
```

### Adaptations

```
Mobile (< 768px) :
  - Sidebar → bottom nav (Dashboard, Sessions, Protect, Settings) + hamburger
  - Tables → card list (chaque row = une card stackée)
  - Graphiques → full width, hauteur réduite (200px)
  - Replay timeline → vertical au lieu d'horizontal
  - Bento grid → single column
  - Pricing cards → vertical stack
  - Hero 3D → réduit (moins de particules, caméra plus loin)
  - Padding : 16px au lieu de 32px

Tablet (768px - 1024px) :
  - Sidebar : collapsée (icons only, 64px) avec expand on hover
  - Tables : scroll horizontal si nécessaire
  - Bento grid : 2 colonnes

Desktop (> 1024px) :
  - Layout complet comme décrit
```

---

## 7. COMPOSANTS shadcn/ui UTILISÉS

```
── Layout ─────────────
Sheet (sidebar mobile)
ScrollArea
Separator
Tabs

── Data display ───────
Table
Badge
Card
Avatar
Tooltip
HoverCard

── Inputs ─────────────
Button
Input
Select
Switch
Slider
Checkbox
RadioGroup
Textarea
DatePicker

── Feedback ───────────
Alert
AlertDialog
Toast (notifications)
Progress
Skeleton

── Overlay ────────────
Dialog (modals)
Popover
DropdownMenu
Command (search)

── Navigation ─────────
NavigationMenu
Breadcrumb
```

### Customisation shadcn/ui

```
Tous les composants shadcn/ui sont customisés pour matcher le design system :
  - Border-radius : 12px (au lieu du default 8px)
  - Colors : nos CSS variables (pas les defaults Tailwind)
  - Focus rings : accent/50 au lieu de blue
  - Backgrounds : glass style au lieu de solid
```

---

## 8. ICÔNES

```
Librairie : Lucide React (lucide-react)
Taille default : 16px (dans le texte), 20px (dans les boutons), 24px (standalone)
Color : inherit (suit la couleur du texte parent)
Stroke width : 1.5 (pas 2 — plus léger, plus premium)

Module icons :
  Monitor : BarChart3 ou Activity
  Replay  : PlayCircle ou RefreshCcw
  Protect : Shield ou ShieldCheck

Status icons :
  Success : CheckCircle2 (success color)
  Warning : AlertTriangle (warning color)
  Error   : XCircle (error color)
  Info    : Info (info color)
  Frozen  : Snowflake (error color)
```

---

## 9. DARK MODE — RÈGLES STRICTES

```
1. JAMAIS de background blanc ou gris clair
2. JAMAIS de texte noir (#000000)
3. JAMAIS de bordures grises opaques
4. Les images/screenshots dans le marketing sont toujours en dark mode
5. Les emails (Brevo) sont aussi en dark mode (background sombre)
6. Le code preview est sur fond noir (#000000/30 sur glass)
7. Les PDF générés sont en dark mode (background #1a1a2e)
8. La page de partage Replay est en dark mode
9. La documentation publique est en dark mode
10. L'erreur 404 est en dark mode
```

---

## 10. PERFORMANCE FRONTEND

```
── Cibles ─────────────────────────────────────────
LCP (Largest Contentful Paint)  : < 2.0s
FID (First Input Delay)         : < 100ms
CLS (Cumulative Layout Shift)   : < 0.1
TTFB (Time to First Byte)       : < 200ms (Vercel Edge)

── Optimisations ──────────────────────────────────
Three.js (Hero 3D)   : dynamic import, no SSR, lazy load
Recharts             : dynamic import (ne charger que sur les pages dashboard)
Images               : next/image avec lazy loading
Fonts                : Inter + JetBrains Mono via next/font (self-hosted)
CSS                  : Tailwind purge (seules les classes utilisées)
Bundle               : code splitting par route (Next.js App Router automatique)
WebSocket            : une seule connexion par dashboard session

── Règles ─────────────────────────────────────────
- Pas de bibliothèque d'animation lourde (pas de Framer Motion en entier — juste GSAP pour le hero si besoin)
- Pas d'images non optimisées
- Pas de fonts custom lourdes (> 100KB)
- Skeleton loading pour tout ce qui fetch des données
- Les graphiques ont un fallback texte pendant le chargement
```

---

> **Règle :** Le design d'AgentShield doit donner l'impression d'un produit premium, pas d'un side project.
> Dark mode exclusif. Glassmorphism. Animations subtiles. Données lisibles.
> Si un composant ressemble à un dashboard Bootstrap/Material UI 2020, il est refusé.
