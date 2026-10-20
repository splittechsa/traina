# Traina final product readiness report

Date: 2026-10-20 (Asia/Riyadh). Recommendation: **NO-GO for commercial launch**.

This report records an implementation and verification pass. The requested whole-platform completion remains unfinished. The 447-row [launch inventory](LAUNCH_MATRIX.json) separates targeted checks from requirements that remain NOT_TESTED. It is not a claim of exhaustive acceptance audit.

## Repository and external state

- Repository: splittechsa/traina. Code branch: release/member-reliability-2026-10-20, HEAD 40633ae. Started at acb049d with 22 modified/untracked paths; that work was retained in the reviewed commit sequence. Application changes are committed and published as draft PR #50, stacked on PR #49.
- Fresh GitHub verification and fetch confirmed origin/master at 99063d5. PR #43 merged at a2d7011, #44 at 72ae927 and #45 at 99063d5. PR #46, #47, #48 and #49 remain OPEN. PR #49 has successful API checks and failed mobile checks caused by the two stale inset assertions corrected in PR #50. PR #48 has a separate failing design-token color assertion and requires reconciliation.
- Backup branch backup/dirty-tree-2026-10-17 still resolves to 0a45fdd5cfbca68defae8f20154479e7acae6037. It was not changed.
- GitHub CLI authentication is now verified as splittechsa. Draft PR #50: https://github.com/splittechsa/traina/pull/50. No PR was merged. The supplied project board requires read:project; the user declined that additional scope, so board inspection is skipped. Workflow scope was also declined: CI workflow changes remain only on the local release/launch-hardening-2026-10-20 branch, not in PR #50.
- Neon configuration matches project fragrant-fog-72018396, branch production. Read-only schema metadata inspection succeeded: 92 public tables, migrations 0001–0030 applied. No production customer rows were read. No production writes, migrations, deployment, payment activation or store submission were performed.
- Migration 0031_program_member_customize.sql exists locally but is absent from the inspected production migration history. The program editor must not be represented as production-integrated.

## Changes implemented in this pass

1. Repaired API exercise substitution types while preserving exercise fields in the mapped result. Repaired invalid typography tokens in the existing YazanCard.
2. Moved member program editing into one transaction, locking the owned active program before reading its version. All days are validated; removed customized days cannot be silently restored from the catalog. Invalid stored documents fail instead of silently dropping adaptation metadata. API edits accept expectedVersion; the current editor sends its original draft version and receives localized conflict guidance when stale. Existing clients without expectedVersion remain backward-compatible; they do not receive stale-client protection.
3. Added program integration coverage for concurrent saves, cross-member denial, stale-save rejection and atomic rollback for invalid exercise changes.
4. Repaired form initialization in Yazan chat, food portions/barcode selection, weight, macros, workout values and program editor. Drafts no longer reset on an ordinary program refetch or exercise-object refresh. Removed render-time ref mutation and adjusted Reanimated shared-value access. Corrected stale tab-clearance assertions to the existing floating-bar geometry.
5. Repaired workout offline synchronization: use a fresh server read instead of the optimistic query cache to confirm replays; retain rejected commands and conflicts; preserve dependency ordering after failed sends; keep queued edits visible in fetched workout projections; block completion while commands remain pending.
6. Replaced whole-queue delete/reinsert with append and transactional acknowledgement. SQLite insertion order now controls create-before-replace ordering instead of random UUID order. Acknowledgement deletes only confirmed commands, preserving newly appended work and unresolved conflicts. Storage failures roll back the acknowledgement batch. Exact final server state also acknowledges create/edit chains after a local acknowledgement failure, including safe acknowledgement after workout completion without terminal-session writes.
7. Repaired rest timers to use clock deadlines rather than interval tick counts. Paused remaining duration is persisted, resumed deadlines are renewed, and skip clears saved state. Added timer tests for backgrounding, paused restart and invalid/legacy state.
8. Added explicit account-closure confirmation and error handling, truthful closure/export labels, and suppressed success after share-sheet dismissal. Corrected public and in-app deletion disclosures in Arabic and English.
9. Added an actual HTTP acceptance smoke command using a disposable synthetic PGlite database. Prepared CI definitions to include it, mobile lint and coach portal build. These workflow edits are local-only because the additional scope was declined. All four existing remote API/mobile CI check runs passed on PR #50 at exact head 40633ae3ce625b0c7e7e856df7b71594ba216dfa.

These changes are implemented and locally tested; native-device approval and independent review remain outstanding. No security-sensitive changes were merged.

## Verification evidence

Evidence directory: docs/evidence/launch-2026-10-20.

| Check | Result | Scope |
| --- | --- | --- |
| Root build | PASS | Domain, contracts, design tokens, API compile |
| Root typecheck | PASS | Compile-time only |
| Domain tests | 134 PASS | Existing plus pre-existing local program cases |
| Contracts tests | 3 PASS | Contracts suite |
| Design token tests | 1 PASS | Token suite |
| API tests | 61 PASS | Includes new program editing regression scenario |
| Mobile tests | 104 PASS | 28 files, including actual SQLite adapter tests and timer tests |
| Mobile typecheck | PASS | Does not establish native correctness |
| Mobile lint | PASS with warnings | No errors; remaining warnings recorded in mobile-lint.txt |
| Coach portal production build | PASS | 30 modules; 235.31 kB JS / 72.77 kB gzip observed in local build |
| Actual loopback HTTP journey | PASS | Account, onboarding, program editing, workout sets/completion, cross-member denial, account session revocation |
| Live AI synthetic smoke | PASS for three observed cases; evaluation incomplete | Missing measurement, absent human feedback, fabricated approval refusal |
| GitHub CI at PR #50 head 40633ae | PASS | API and mobile on push and pull_request; four successful check runs |
| Physical iPhone / Android | BLOCKED | No device capture or signed build evidence |
| Native startup/memory/battery/media performance | NOT_TESTED | No native profiling |
| Production backup restoration | NOT_TESTED | Backup branch existence is not database restore evidence |
| Payment/store lifecycle | NOT_TESTED | No verified gateway or purchase sandbox |

The initial domain test run failed before test execution because the sandbox temporary directory was inaccessible. Rerunning with a writable task temporary directory passed. This was a test infrastructure issue, not 18 demonstrated product failures. The initial mobile run exposed two stale clearance assertions; after aligning them with the existing intended geometry, the suite passed. Native clearance still needs device verification.

## AI observations

The configured live compatible provider answered synthetic-only requests. It stated that no body weight was available, stated that no human coach feedback existed, and refused a request to claim a fabricated program change/approval. Observed latency ranged from 740 to 3057 ms; all tool reads used synthetic authorized projections. Raw responses and reported usage are in ai-live-smoke.json. These three cases do not establish broad safety, Arabic quality, hallucination rate, prompt-injection resistance, cost limits or production readiness. AI runtime/tool authorization remains subject to the broader evaluation backlog.

## Remaining implementation and acceptance gaps

- Complete native journeys, screen-state coverage, accessibility and RTL/LTR acceptance. The current program editor still lacks complete sets/reps/rest editing, saved-program duplication/history/restore and unsaved-change acceptance.
- Offline commands now survive sync failures, but full offline cold-start recovery, account-isolated persisted snapshots and explicit conflict-resolution UI need completion and native testing.
- Exercise media is procedural and visibly labeled unreviewed. It does not satisfy the requested specialist-approved realistic commercial exercise demonstrations, rights evidence and mobile performance acceptance.
- Finish nutrition recipe provenance, ingredient/serving correctness and complete native meal creation/logging acceptance.
- Expand AI evaluation and operational controls; verify the complete approved adaptation loop through actual member and coach clients.
- Obtain a new coach UI walkthrough, qualified operational staffing evidence, service response monitoring and complete support operations.
- Billing is not launch-ready. Payment adapter/verification/webhooks, purchase restoration, signed lifecycle events, reconciliation, refunds, IAP/platform handling and sandbox evidence remain open. Purchases stay disabled.
- Push token registration is not delivery. Delivery provider, quiet hours/preferences, deduplication and permission/deep-link acceptance remain open.
- Account export currently returns summaries, not complete historical portability. Account deletion is soft closure plus session revocation, not proven erasure. Complete export, erasure/retention policies, coach-sharing consent and legal disclosures.
- Public website is a draft; installation links, truthful finalized product claims, approved pricing/legal text, verified support ownership, localization, SEO and responsive/browser evidence remain open. Deletion copy was corrected in Arabic and English to describe account closure and retained records; a qualified erasure/retention policy is still required.
- EAS preview configuration contains a placeholder staging URL. Staging service, Expo account/project access, signing and actual installable builds/device checks remain outstanding.
- Production backup restoration, disaster recovery, monitoring/alerting, queue operations, retention, load tests and native performance lack release evidence.
- Independent security review and deployment review remain open. Existing PR status has been verified remotely; PR #50 checks are tracked in github-status.json. Project-board access was skipped at the user’s request.

## Non-bypass approval gates

P0-PRIV remains BLOCKED pending qualified Saudi legal/privacy review. ENERGY_POLICY remains BLOCKED pending qualified scientific approval. Apple/Google distribution and billing-policy decisions need current qualified review for the actual products and territories. No generated documentation substitutes for these approvals.

## Release decision

**NO-GO.** Working code and repeatable evidence have improved, but major implementation gaps and external approvals remain. A focused engineering review candidate is published as draft PR #50; a fully verified commercial release candidate does not. Consult the authoritative matrix for untested requirements and the operations runbooks for reproducible next actions.

## Published code references

- c1902b8 — versioned customization and contextual coaching, including existing prepared feature work.
- 9eefd34 — durable offline writes and rest timer persistence.
- baa3216 — closure confirmation, accurate disclosures and form initialization.
- 86b60fb — acknowledged offline chain recovery.
- 40633ae — repeatable HTTP and local validation commands.

The original local branch release/launch-hardening-2026-10-20 also preserves the unpublished workflow commit 5ab5a2f. The historical backup branch is unchanged.
