# Sahhti — cross-screen UI overhaul

This is a **drop-in mobile UI source overlay**, not a full repository or a verified release.

## Changed
- `src/theme/tokens.ts`: coherent athletic dark/light palettes, better type hierarchy.
- `src/ui/kit.tsx`: horizontally scrolling sport filters, improved row touch spacing.
- `src/ui/Screen.tsx`: tighter safe-area screen composition.
- `src/ui/TabBar.tsx`: larger tab touch regions.
- `app/(tabs)/home.tsx`: photographic training hero, legible overlay and action-first presentation.
- `app/(tabs)/training.tsx`: real-session-backed featured workout, clear CTA, compact exercise discovery with link to existing library.
- `app/progress.tsx`: clearer metric presentation and a guided zero-data state.
- Other screens remain included and wired to the existing API. Their full visual overhaul is **not** complete.

## Install
Copy `app/`, `src/`, and `assets/` into `apps/mobile/` of the original monorepo, merging files. Do **not** replace your repository with this ZIP. Back up/commit before copying.

## Not verified
This environment has no full monorepo dependency tree or iOS simulator. No physical-device, TypeScript or E2E success is claimed. Run `npm run typecheck` and `npm test` in the real repository and test iPhone screenshots.

## Security
No `.env` files or credentials are included. Backend/database remain untouched.
