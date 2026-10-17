# Infrastructure gap analysis — Traina vision vs repo

**Date:** 2026-10-17  
**Baselines:** `origin/master` @ `84f5639` · recoverable work @ `backup/dirty-tree-2026-10-17` (`0a45fdd`)  
**Status legend:** Existing · Partial · Missing · Quarantined

This is an engineering gap map, not a claim of product readiness for paid coaching.

---

## Component matrix

| Component | Vision role | Status | What exists | What is partial | What must be developed |
| --- | --- | --- | --- | --- | --- |
| **Member State Engine** | Deterministic state from validated observations | **Partial (foundation started)** | `packages/domain/src/member-state.ts` (`assembleMemberState`, confidence, no false non-adherence) | Not wired to API/events; no persistence; empty `pendingRecommendations` | Event ingestion, API projection, confidence gates on recommendations, history |
| **Scientific Rules Engine** | Versioned evidence registry + safe calculations | **Partial / Quarantined** | Meal-plan energy helpers, logging discipline, weight trend helpers, coaching_rules tables in SQL | Fixed cut deficits 400/650/1100 **quarantined** (`ENERGY_POLICY`); no evidence registry UI; SME review missing | Policy registry with rationale/tests/approval; individualized energy post-SME; reject extreme horizons |
| **Recommendation / Adaptation Engine** | Reviewable recommendation state machine | **Partial** | `proposeWeeklyNutritionStep` (propose-only, `mayAutoApply: false`); coach tools return `not_applied` | No DRAFT→APPLIED machine; no versioned plan apply/rollback | Full state machine, human/member approval gates, plan versioning |
| **Yazan AI orchestration** | Tool-oriented coach on real state | **Partial** | Daily check-in / weekly brief domain; coach provider persona; typed coach tools; chat routes | Not MemberState-backed; live provider optional (#7); context packing incomplete | Tool gateway on MemberState; minimal context; budgets; no fabricated human review |
| **Human Coach Dashboard** | Assigned coaches review weekly packets | **Missing** | Weekly brief can be `queued_for_human`; packet builder in domain | No coach app/UI; no assignment queue UX | Roster, queue, approve/reject/edit, feedback delivery, access audit |
| **Weekly review queue** | Member survey → packet → human workflow | **Partial** | `coach_weekly_briefs`, member week-report screen (local), packet builder | No assignment/IN_REVIEW/FEEDBACK_SENT automation; no overdue handling | Full workflow + SLA surfaces + escalation |
| **Privacy, consent, audit** | Purpose-tagged processing + access logs | **Partial** | Privacy docs; `consents` table schema; `audit_logs`; data inventory Appendix A | No purpose-tagged consent ledger runtime; legal basis design BLOCKED on counsel | Consent ledger, retention jobs, deletion UX, coach access logs, transfer assessment |
| **Subscription entitlements & billing** | Entitlements ≠ UI; StoreKit verification | **Partial** | Domain subscription/capabilities; products tables | No StoreKit wire; no server receipt verification; SKUs TBD (#24) | Entitlement service, Apple events, grace/refund, fair-use AI budgets |

---

## Supporting systems

| Area | Status | Notes |
| --- | --- | --- |
| Auth & profiles | **Existing / Partial** | Session auth when secret set; onboarding sex/pace on dirty tree |
| Daily logging | **Partial** | Migrations + API + mobile screens on backup branch |
| Job workers | **Missing** | No queue for weekly jobs / AI batch |
| Saudi hosting readiness | **Docs only** | #13 / P0-PRIV |

---

## P0-SAFE-01 path audit (nutrition)

| Path | Role | Gated? |
| --- | --- | --- |
| `POST /v1/training/programs/nutrition` → `setProgramNutrition` | **Paid apply** | Yes — `assertEnergyPolicyApprovedForPaidCoaching` |
| `GET .../nutrition/propose` → `proposeProgramNutritionStep` | Propose only | Marks `mayAutoApply: false` / unapproved flag |
| `athleteEnergyPlan` | Compute placeholder | Returns `policyApprovedForPaidCoaching: false` |
| Mobile `estimateTargets(..., 'training')` | Absolute deficits | Throws until approved |
| Mobile `targetsFromOnboarding` | Local estimate | **Free style only** (soft %) — tracking preserved |
| `PUT /v1/nutrition/meal-plan` | Member day plan logging | Allowed (member-entered target; not policy apply) |
| Coach tools `proposeNutritionAdjustment` / `proposeProgramAdjustment` | AI | `not_applied`, `persisted: false` |
| Background jobs | Apply nutrition | **None exist** |

**VERIFIED blocked until:** qualified sports-nutrition review signs ENERGY_POLICY + any remaining apply paths audited again.

---

## Dirty-tree reconciliation

See `docs/roadmap/DIRTY_TREE_INVENTORY.md` and branch `backup/dirty-tree-2026-10-17`.
