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
