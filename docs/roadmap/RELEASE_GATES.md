# Current Arabic/native closure and Android request — 2026-10-21

**NO-GO; experience PARTIAL.** Source RTL and interaction fixes implemented in PR58; no fresh physical screenshot/recording acceptance. User reported opening/navigation error; staging configuration corrected and optional read-cache blocking removed, but phone resolution remains unverified. Android SDK, Java, emulator and Android36 image are now installed after the user freed disk space; emulator launch is BLOCKED on Windows virtualization and the protected preferences directory. Five reviewed exercise clips remain BLOCKED individually; no assets/approvals fabricated.

Evidence: [route-by-route source review](../evidence/arabic-native-closure-2026-10-21/RTL_AUDIT.md), [five clip blockers](../evidence/arabic-native-closure-2026-10-21/EXERCISE_MEDIA_BLOCKERS.md), [Android setup](../ops/ANDROID_EMULATOR_ACCEPTANCE.md). PR57→PR58 dependency order and independent approvals/current-head CI remain required. Signed iOS acceptance still requires Apple distribution credentials. Previous engineering and development-device evidence below is historical, not acceptance of these new interfaces.

# Current device and experience gates — 2026-10-21

**Release NO-GO; transformation PARTIAL.** Actual physical iPhone Expo Go screenshots, bounded JS traces, before/after observations and synthetic set persistence checks now exist. The historical blanket hardware-blocked claim below is superseded for these specific journeys only. See [experience evidence](../evidence/experience-2026-10-21/REPORT.md).

| Gate | Current evidence / remaining work |
| --- | --- |
| Storage / workout input | Implemented; 137 mobile tests; physical scripted beginner and experienced journeys; review required |
| Performance | Development-only observations; native FPS/memory/cold-start/release-mode/Android remain NOT_TESTED |
| Exercise demonstrations | BLOCKED: licensed, technically reviewed realistic trainer/animation assets absent |
| Native usability | PARTIAL: real screenshots and handlers; independent human tasks, English/RTL restart, accessibility, recordings and next-day return open |
| Completion | Replay-safe completion deployed to isolated staging; HTTPS completion/replay PASS; native human retry after reported error open |
| Yazan | Context action retained; clinical/coaching quality acceptance open |
| Release / merge | Required review, privacy, ENERGY_POLICY, billing and platform-policy gates remain intact; no merge authorized |

Follow-up: [save feedback latency](../evidence/experience-2026-10-21/SAVE_FEEDBACK.md) removes additional waits; new physical latency verification remains open after disconnect.

## Historical evidence below

> **2026-10-20 current audit:** NO-GO. [Readiness report](../architecture/FINAL_PRODUCT_READINESS_REPORT.md) and [authoritative inventory](../architecture/LAUNCH_MATRIX.json) supersede unsupported completion claims below. Fresh GitHub verification confirms #43–#45 merged and #46–#49 open. Draft #50 contains the published hardening changes. The user declined workflow/read:project scopes; workflow edits remain local and board access is skipped. Physical-device evidence remains BLOCKED. Production Neon has 0001–0030; local 0031 is not deployed. Historical entries are retained for traceability.

# Release gates

| Gate | Exit criteria | Evidence |
| --- | --- | --- |
| **P0** Engineering truth + privacy/safety foundations | Reproducible build/tests; gap matrix current; unsafe nutrition presets flagged; personal data inventory; coaching service boundary defined; legal/regulatory review tasks tracked (not claimed done); dirty-tree backup recoverable | CI green; backup branch preserved; `MASTER_TODO` P0 items REVIEW→VERIFIED with evidence; counsel engagement recorded for privacy |
| **P1** Coaching intelligence | MemberState wired to validated events + evidence registry + constrained recommendations + Yazan tools; member confirmation; no free-form plan invent | Unit/integration tests for S-* cases; tool schemas reviewed |
| **P1-REC-04** Real training adaptation apply | Authorized training recommendation mutates versioned program atomically; workout reflects overlay; no duplicate apply; nutrition blocked | PR #43 + `program-adaptation.integration.test.ts` (concurrent/idempotent/stale/IDOR/ENERGY_POLICY); Neon 0025–0027; **REVIEW until merge** — evidence `docs/architecture/pr43-release-hardening.md` |
| **P2** Human coaching ops | Coach completes full weekly loop without DB access; access control + audit | Pilot coach walkthrough recording / checklist |
| **P2/P3 Billing** Web subscription + entitlements | Website checkout via gateway; server verification + signed webhooks; entitlement service; lifecycle (renew/cancel/grace/refund); no PAN/CVV storage; billing tests (success, duplicate/delayed webhooks, failed renewals, refunds, expiry, concurrency, unauthorized mutation, reconciliation) | **Partial:** `GET /v1/member/entitlements` + free projection test + membership UI (`product/completion-entitlements-help`). Still missing: gateway, webhooks, paid lifecycle. Landing draft: `apps/www`. |
| **P3 Apple** App Store purchase policy | Written strategy for Guidelines **3.1.1** / **3.1.3**; IAP channel into same entitlement schema where required; **no** prohibited external-purchase CTAs from iOS; Traina Coach not auto-classified as P2P exempt | Counsel + App Review notes; StoreKit sandbox purchase → same entitlements; App Review submission checklist |
| **P3** Commercial + mobile product | Paid member receives advertised tier via **server** entitlements on supported clients | Cross-client account check after web and/or IAP purchase |
| **P3-MOBILE-DEVICE** Physical iPhone/Android acceptance | Reconstructed UX captured on real devices; RTL/nav/workout/nutrition/Yazan/weekly checklists PASS | **BLOCKED** — Apple signing / device hardware (see `docs/ops/EAS_DEVICE_QA.md`). Code/auto tests may proceed. States: PASS/FAIL/BLOCKED/NOT TESTED/PARTIAL — do not mark FAIL solely for missing devices. |
| **P3-PUSH** Push infrastructure | Register Expo tokens server-side; delivery provider configured separately | Token register **IN_PROGRESS**; delivery **BLOCKED** until Expo/FCM secrets + ops |
| **P3-ACCOUNT-PORTABILITY** Export + delete | Export excludes secrets; delete soft-closes account | Export/delete APIs **REVIEW** |
| **P4** Controlled pilot | Consenting adults; supervisors; turnaround/cost/safety metrics documented | Pilot report |

## Non-bypass rules

- Billing and App Store work **must not** skip P0 safety (`ENERGY_POLICY`) or privacy/consent gates.
- **DONE** for paid coaching requires safety + privacy + entitlement + (for iOS unlocks) Apple policy evidence.
- **Never** skip regulatory/security review to accelerate App Store submission.

Statuses for tasks: `BACKLOG → READY → IN_PROGRESS → REVIEW → VERIFIED → DONE` (+ `BLOCKED` with reason).  
**DONE** requires objective verification — not “file exists.”

## Remaining App Store policy blockers (current)

1. **P3-APPLE-POLICY-01** — no counsel-signed reading of 3.1.1 / 3.1.3 for Traina AI / Traina Coach.  
2. **IAP parity** — if iOS unlocks digital coaching features for web subscribers, Apple’s multiplatform language currently expects those items **also** available as IAP.  
3. **External checkout from iOS** — not assumed legal; do not implement purchase redirects / misleading upgrade prompts.  
4. **P2P exception** — live person-to-person coaching evaluated separately; async human review + AI **not** auto-exempt.  
5. Guidelines change (e.g. Oct 2026 updates) — re-verify before each iOS submission: https://developer.apple.com/app-store/review/guidelines/
