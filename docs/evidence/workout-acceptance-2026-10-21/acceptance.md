# PR 58 acceptance evidence — 2026-10-21

**Overall: PARTIAL. Do not mark the workout transformation DONE.**

## Implemented and locally verified

- Cursor history API with precise timestamp/ID ordering, filter/account-bound cursors, bounded page size and independent active-session discovery. Added migration 0035 indexes. Mobile renders 20 sessions per page, releases unused cursor queries and persists first pages only. Legacy unbounded responses are rejected before snapshot persistence.
- Completed-workout summary uses server-owned sets and compares records with sessions predating workout start. First-ever results are labeled separately. Completed/paused Yazan cues reflect actual status.
- Refresh token rotation is atomic. Mobile handles late old-token 401s; admin requests serialize across supporting browser tabs and losing refreshes cannot erase winner cookies. API deadlines now include response body reading.
- Lazy exercise technique/approved-video pipeline with license and professional-review gates. **Zero approved assets.** No 3D coverage claimed.

## Validation

Root build/typecheck passed. Domain 136, contracts 3, design tokens 1, API 81, admin gateway/transport 8 and mobile 145 tests passed (374 total). Mobile typecheck passed; lint has zero errors and five existing warnings.

The real Fastify/PGlite lifecycle test logs duplicate/replayed sets, edits, pauses/resumes, deliberately drops a successful completion response, reconciles through the actual mobile helper, retries completion, checks ownership and compares results after server restart. This is automated headless evidence, not an iPhone recording or an app-process restart test.

History integration tests traverse 100, 500 and 1,000 sessions with exact timestamp ties, backwards paging, no loss/duplicates, payload limits and account/filter rejection. Mobile cache tests traverse 50 cursors and retain at most two queries after GC. These do not measure native heap/FPS.

Optimized iOS Hermes export succeeded: 2,102 modules, approximately 5.7 MB bundle. This proves bundling only. No release startup, navigation, FPS or native memory numbers are inferred.

## Review order and integration gates

PR57 base dependency: reviewed admin BFF Origin/method/route allowlists, secure HTTP-only cookie handling, admin authorization and concurrent refresh behavior. Found and fixed the refresh loser-cookie race in PR58; eight admin tests cover the transport.

PR58: reviewed account isolation, atomic refresh consumption, cursor ties/filter scoping, set replay/CAS, completion reconciliation, prior-result ownership, migration compatibility and media defaults. Findings fixed and covered by tests. This author-side review is not independent approval. Both PRs had no submitted approving reviews when checked. Review PR57 first, then PR58 against its final head; do not merge until required approvals and current-head CI pass.

## Actual iPhone acceptance — blocked

EAS internal iOS build was attempted and failed because suitable distribution credentials were unavailable. The user confirmed no Apple Developer account is available. No new signed build, installation, screen recording or release-like device measurements exist. Expo development evidence from earlier commits cannot satisfy this gate.

When signing is available: in apps/mobile run `eas credentials --platform ios`, register the device, then `eas build --platform ios --profile preview`. Verify EXPO_PUBLIC_API_URL points to the dedicated staging API. Install the resulting artifact and record the exact commit/build/device/OS, visible timing and backend set/session IDs. Exercise start, rapid sets, edit, pause/resume, finish, lost response/retry, history and app restart. Confirm successful completion never produces an error. Repeat offline/reconnection with durable queues and account switching. Avoid real customer data.

## Remaining gates

- Signed release-like iPhone build, full recording, native app restart/offline acceptance and measured responsiveness/memory.
- Qualified exercise/technique review and real licensed media, followed by actual playback/cache device checks.
- Independent PR57 then PR58 approval and final-head CI. No merge performed.
- Staging purchase readiness remains separate: live payments stay disabled; missing store verifier readiness is not workout acceptance.

## Public staging measurements

API deployment `dpl_GZMu3778swxmjv7WeRpDyfSjYZQW`, admin `dpl_7kY5iV7zwjUzZgBqMGDUWbZGdj4C`. Actual URLs: https://traina-staging-api.vercel.app and https://traina-staging-admin.vercel.app. Website remains https://traina-staging-www.vercel.app. Migration0035 applied only to isolated staging.

Public HTTPS traversal: 100 sessions/5 pages p50 547ms p95 723ms; 500/25 p50 477ms p95 518ms; 1000/50 p50 473ms p95 535ms. Maximum 20 rows and 6,339 bytes per response. All IDs unique, counts matched. These are sequential warm requests from this host, not a release-device benchmark or universal latency guarantee. Query plans are included in public-history-benchmark.json. Counts still aggregate owned history and may need further tuning beyond tested sizes.

Public completion returned200 in636ms in one sample; separate replay sample completed in955ms and returned200 with identical completedAt on replay. No performance percentile is inferred from two samples. Public lost-response/native-offline recording remains unverified.

Reproduce synthetic staging history benchmark on this Windows host with TRAINA_PERF_FIXTURE_DIR pointing to the private DPAPI cache and `node scripts/benchmark-workout-history.cjs`. It explicitly guards the isolated project/database, creates synthetic accounts in outbox mode, seeds histories, traverses public APIs and records sanitized metrics. It does not export credentials.
