# Uncommitted inventory & PR split — 2026-10-18

**Branch:** `p2/coaching-experience-readiness` @ `deb009d`  
**Backup (do not delete):** `backup/dirty-tree-2026-10-17` (local + `origin`)  
**Neon migrations applied:** `0025_recommendation_lifecycle.sql`, `0026_member_in_app_notifications.sql` (verified on project `fragrant-fog-72018396`)

## Working tree groups (do not blind-stage together)

| Proposed PR | Scope | Paths |
| --- | --- | --- |
| **A — Recommendation lifecycle** | Domain SM expire/dedupe/apply helpers + migrate 0025 + API generate/list/advance | `packages/domain/src/recommendation.ts`, `recommendation.test.ts`, `database/migrations/0025_*`, `services/api/src/member/store.ts` (rec parts), `routes/product.ts` (advance), `migrate.integration.test.ts` |
| **B — Yazan tools** | Tool surface + provider allowlist | `packages/domain/src/coach-tools.ts`, `coach-tools.test.ts`, `services/api/src/coach/provider.ts` |
| **C — In-app notifications** | Migrate 0026 + API + mobile screen | `database/migrations/0026_*`, store notification fns, `product.ts` routes, `apps/mobile/app/notifications.tsx` |
| **D — Entitlements foundation** | Domain only (no paywall) | `packages/domain/src/entitlements.ts`, `entitlements.test.ts`, `index.ts` export |
| **E — Coach portal + weekly UX + docs/evidence** | Portal claim fix, weekly confirm UI, MASTER_TODO, evidence | `apps/coach-portal/**`, `apps/mobile/app/weekly-checkin.tsx`, `copy.ts`, `docs/**`, `scripts/coach-cohort-ops.mjs` |
| **F — Real program apply (this milestone)** | Versioned adaptation service | `program-adaptation.ts`, migrate `0027_*`, store transactional apply, preview API, mobile diff |

Statuses remain **IN_PROGRESS / REVIEW** until each PR is reviewed and merged — not VERIFIED from local work alone.

## Neon 0025 / 0026 — deploy & rollback

**Deploy (staging → prod):**  
1. Backup / snapshot Neon branch.  
2. `npm run migrate` (or apply files in order) with `DATABASE_URL_UNPOOLED`.  
3. Smoke: generate recommendation; send coach feedback → notification row.  
4. Deploy API build that expects `safety_class` column and `member_in_app_notifications`.

**Rollback:**  
- **App:** redeploy previous API image (must tolerate missing 0026 table — notification insert is catch-swallowed; 0025 `safety_class` writes require column).  
- **Schema:** do **not** DROP 0025/0026 in place. If revert required, ship forward fix migration. Snapshot restore only with ops approval.

**Idempotency:** `schema_migrations` rows present; re-run migrate is no-op.
