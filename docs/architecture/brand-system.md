# Traina brand system (working standard)

**Personality:** intelligent, athletic, trustworthy, scientifically calm, premium-simple.  
**Not:** neon AI kitsch, purple SaaS dashboards, dumbbell clichés, fake testimonials.

## Core palette

| Token | Value | Role |
| --- | --- | --- |
| Charcoal | `#161411` | Primary ink |
| Forest | `#315C49` | Action / accent |
| Gold | `#D6A54A` | Earned moments, mark detail |
| Paper | `#F3EEE6` | Light ground |
| Sand | `#C9B7A2` | Secondary texture |

Light/dark semantic tokens live in `apps/mobile/src/theme/tokens.ts`.

## Typography

- **Arabic + Latin:** IBM Plex Sans Arabic (SIL OFL) — one family for bilingual UI.
- Scale: hero 34 · title 28 · headline 22 · card 18 · body 16 · label 13 · micro 11.

## Mark

Current app mark: ascending path + baseline + gold node (`TrainaMark` in `apps/mobile/src/ui/brand.tsx`).  
Vector export pack (SVG lockups, adaptive icons, favicon) remains open — do not claim trademark clearance.

## Motion

Subtle fades and emphasis timings via `apps/mobile/src/theme/motion.ts`. Respect reduced motion.

## Usage rules

1. Brand or product name must read as a first-class signal on marketing surfaces.
2. No fabricated social proof, awards, or medical endorsements.
3. Arabic-first copy with high-quality English localization.
4. Cards only when they contain interaction or structured status.
