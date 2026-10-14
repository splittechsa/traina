# Sahhti UI — Phase 1

Modified: `app/(tabs)/home.tsx` only.

- New compact home hierarchy, hero action, four quick actions, daily metric cards and weight tracker.
- Retains real `/v1/home`, `/v1/me`, `/v1/progress` requests and existing routes.
- Does not fabricate metrics or alter database/API.
- No device or TypeScript execution was performed in this environment; run `npx tsc --noEmit` in apps/mobile and test on iPhone.
- Remaining screens, global navigation and design tokens are unchanged.
