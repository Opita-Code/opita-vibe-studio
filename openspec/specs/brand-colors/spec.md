# Brand Colors Specification

## Purpose

Defines the Vibe Studio color system. The palette centers on an "Obsidian + Aura" theme: deep dark backgrounds with cyan and purple accent glows.

## Color System

### Core Palette (Tailwind extensions in `tailwind.config.js`)

| Token | Value | Usage |
|-------|-------|-------|
| `obsidian-900` | `#0b0b0c` | Primary background |
| `obsidian-950` | `#050506` | Deepest background (ActivityBar) |
| `obsidian-800` | `#141418` | Elevated surfaces |
| `aura-cyan` | `#06b6d4` | Primary accent, active indicators, links |
| `aura-purple` | `#a855f7` | AI/Chat accent, Vibe AI branding |
| `vibe-cyan` | `#06b6d4` | Alias for aura-cyan |
| `vibe-indigo` | `#4f46e5` | Legacy primary (used in some buttons) |

### CSS Custom Properties (`src/assets/brand.css`)

```css
--vibe-bg: #0b0b0c;
--vibe-surface: #141418;
--vibe-border: rgba(255, 255, 255, 0.05);
--vibe-text: #e2e8f0;
--vibe-muted: #64748b;
--vibe-cyan: #06b6d4;
--vibe-indigo: #4f46e5;
--glass: rgba(255, 255, 255, 0.05);
```

### Design Language

- **Backgrounds**: `bg-obsidian-900/80 backdrop-blur-3xl` for panels
- **Borders**: `border-white/5` or `border-white/10`
- **Active indicators**: 3px left bar with `bg-aura-cyan shadow-[0_0_8px_rgba(6,182,212,0.6)]`
- **AI elements**: `text-aura-purple` with `drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]`
- **Glass effects**: `bg-white/5 backdrop-blur-xl`

## Files

- `tailwind.config.js` — Color extensions
- `src/assets/brand.css` — CSS custom properties
- `src/index.css` — Global styles
