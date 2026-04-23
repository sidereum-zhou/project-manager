# Precision Architect Restyle Design

## Goal

Restyle the FLUX Project Manager from dark theme to match the "Precision Architect" design system. Content and functionality remain unchanged; only visual presentation (colors, typography, layout, spacing, borders, radius) is overhauled.

## Color System

### Surface Hierarchy (bottom to top)

| Token | Hex | Usage |
|-------|-----|-------|
| surface | #F9F9F9 | Overall app background |
| surface-container-low | #F2F4F4 | Sidebar, toolbar, secondary areas |
| surface-container | #EBEEEF | Wrapper chrome |
| surface-container-high | #E4E9EA | Hover states, bottom bar |
| surface-container-highest | #DDE4E5 | Secondary buttons |
| surface-container-lowest | #FFFFFF | Main work stage, cards, editor |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| primary | #0053DB | Accent, buttons, active state |
| primary-dim | #0048C1 | Gradient endpoint |
| error | #9F403D | Error text |
| error-container | #FE8983 | Error backgrounds |
| on-surface | #2D3435 | Primary text (not pure black) |
| on-surface-variant | #596061 | Secondary text |
| outline-variant | #ACB3B4 | Ghost borders (at 15% opacity) |
| tertiary | #625B77 | Secondary accent (purple) |

### No-Line Rule

Sectioning achieved through background tonal shifts, not 1px borders. Adjacent surfaces of different brightness levels create perceived boundaries.

### Status Colors

| State | Background | Text |
|-------|-----------|------|
| Running | green-100 (#dcfce7) | green-700 (#15803d) |
| Stopped | surface-container-highest | on-surface-variant |
| Failed | error-container at 20% | error |

## Typography

### Font Family

- **UI**: Inter (replaces Aptos)
- **Mono**: JetBrains Mono (unchanged)
- Import via Google Fonts CDN or local bundling

### Type Scale

| Role | Size | Line Height | Weight | Notes |
|------|------|------------|--------|-------|
| Display / Page title | 24px (1.5rem) | 1.1 | 700-900 | Brutalist tight leading |
| Section title | 16px (1rem) | 1.3 | 700 | Card headers |
| Card title / Nav | 14px (0.875rem) | 1.5 | 500-600 | Primary navigation |
| Body (workhorse) | 12px (0.75rem) | 1.6 | 400-500 | Tables, panels, data |
| Label / Metadata | 11px (0.6875rem) | 1.5 | 600 | Uppercase, 0.05em tracking |
| Micro label | 10px (0.625rem) | 1.4 | 700 | Uppercase, tight tracking |

## Spacing

Based on 4px baseline grid:
- Major functional groups: 12px (0.75rem)
- List item gap: 8px
- Panel padding: 16px
- Card padding: 16px-24px

## Border Radius

Maximum 8px (professional tool, not social media):

| Size | Value | Usage |
|------|-------|-------|
| DEFAULT | 2px (0.125rem) | Buttons, inputs |
| lg | 4px (0.25rem) | Small cards, badges |
| xl | 8px (0.5rem) | Large cards, panels |
| full | circle | Avatars |

## Layout Structure

### Sidebar (SideNavBar)

- Width: 240px, fixed, no collapse
- Background: surface-container-low (#F2F4F4)
- Right edge: ghost border (slate-200 at 15% opacity)
- Header: Project name (18px bold) + subtitle (11px uppercase tracking)
- Nav items: Material Symbols icon (20px) + text (12px), px-6 py-2
- Active state: text-blue-600 + border-r-2 border-blue-600 + bg-slate-200/30
- Hover: bg-slate-200/50
- Footer: User avatar + name + workspace label

### TopAppBar

- Height: 48px, fixed
- Background: white (#FFFFFF)
- Bottom edge: ghost border
- Left: Page title (16px bold) + breadcrumb nav (12px)
- Right: Action buttons (play/stop) + user avatar

### Content Area

- Background: surface-container-low (#F2F4F4)
- Padding: 24px
- Cards: white surface-container-lowest, 8px radius, ghost border

### Status Bar (bottom)

- Height: 32px
- Background: white
- System metrics in 11px uppercase

## Component Styles

### Buttons

| Type | Background | Text | Border | Radius |
|------|-----------|------|--------|--------|
| Primary | gradient(135deg, primary, primary-dim) | white | none | 2px |
| Secondary | surface-container-highest | on-surface | none | 2px |
| Tertiary (Ghost) | transparent (hover: surface-container-low) | on-surface | none | 2px |

### Inputs

- Background: surface-container-lowest (white)
- Border: outline-variant at 15% opacity
- Focus: border becomes primary at 100%, no glow/halo
- Label: 11px uppercase, 4px above input

### Cards

- Background: white (surface-container-lowest)
- Radius: 8px (xl)
- Border: outline-variant at 15% opacity
- No divider lines between list items; use 8px whitespace or hover background
- Shadow: Vapor Shadow `0 12px 40px rgba(45, 52, 53, 0.06)`

### List Items

- Differentiation via hover background (surface-container-high), not dividers
- Each item: flex, gap-2, px-4 py-1.5 or py-2

### Badges

- 11px, uppercase, tight tracking
- Status-based coloring (green/gray/red)

### Scrollbars

- Width: 4px
- Track: transparent
- Thumb: #ACB3B4, rounded

### Shadows

| Level | Value | Usage |
|-------|-------|-------|
| Vapor | `0 12px 40px rgba(45, 52, 53, 0.06)` | Floating panels, modals |
| Card | `0 4px 12px rgba(0, 0, 0, 0.02)` | Standard cards |
| Deep | `0 24px 60px rgba(0, 0, 0, 0.15)` | Terminal panels |

### Glassmorphism (floating panels)

- Background: surface-container-lowest at 80% opacity
- Backdrop-blur: 20px (backdrop-blur-xl)
- Ghost border

## Files to Modify

1. **`src/styles/theme.css`** — Rewrite all CSS custom properties to match new palette
2. **`src/App.vue`** — Switch Naive UI from dark to light theme, rewrite themeOverrides
3. **`src/AppLayout.vue`** — New layout structure (240px sidebar, 48px topbar, content area)
4. **`src/views/*.vue`** — Restyle all view components (ProjectList, ProjectOverview, FileExplorer, TerminalPage, GitPanel, ServicesPage, ArchitecturePage, WorkspaceScenesPage, SettingsPage)
5. **`index.html`** — Add Inter font import
6. **`vite.config.ts`** — No changes expected (Tailwind not used; styling is CSS vars + Naive UI)

## Key Rules

1. No pure black text — use #2D3435 (on-surface)
2. No 100% opacity borders — ghost borders at 15%
3. No round beyond 8px — sharp and intentional
4. No 1px divider lines between list items
5. No glow/halo on focus states
6. Use tonal shifts for sectioning, not lines
7. 12px is the workhorse body font size (high-density)
