# Traina Master TODO

**Baseline:** `master` @ `24327cf` (origin) — vision docs + energy quarantine. Local workspace still has substantial uncommitted coaching/logging work.  
**Audit date:** 2026-10-17  
**Org board:** GitHub project “Gym App” + issues #25–#34 (`vision-2026`)

Statuses: `BACKLOG | READY | IN_PROGRESS | REVIEW | VERIFIED | DONE | BLOCKED`

---

## Gap matrix (vision → repo)

| Vision area | Status | Evidence |
| --- | --- | --- |
| Auth register/login/session | **Existing** | `services/api` auth routes; fails closed without secret |
| Onboarding as profile source | **Partial** | Sex/pace/horizon in domain+migration 0020; mobile onboarding updated locally |
| Daily water/food/sessions/supplements/weight | **Partial** | Migrations 0014–0016; APIs present; mobile screens local |
| Meal plan + ready meals | **Partial** | Domain `meal-plan.ts`; API; mobile meal-plan |
| Fixed cut deficits 400/650/1100 | **Quarantined** | `ENERGY_POLICY.approvedForPaidCoaching=false`; paid apply + mobile `training` style blocked |
| Yazan persona + chat | **Partial** | Provider persona; needs live model (#7) |
| Daily check-in | **Partial** | `POST /v1/coach/daily-checkin`; domain `yazan-coach.ts` |
| Weekly brief queued_for_human | **Partial** | Table + API; **no coach dashboard** |
| MemberState engine | **Missing** | — |
| Evidence / policy registry | **Missing** | — |
| Recommendation state machine + versioned apply | **Missing** | Propose-only paths |
| Human coach ops UI | **Missing** | — |
| Consent ledger | **Missing** | Privacy docs only |
| Store entitlements | **Partial** | Domain subscription; no StoreKit wire |
| Job workers / queue | **Missing** | — |
| Legacy `app/` / `src/` trees | **Stale** | Do not ship; product is `apps/mobile` |

### Prior issues — map / supersede

| Old # | Title | Mapping |
| --- | --- | --- |
| #17 | Epic Traina Training | Superseded by this master backlog (keep open as parent epic label) |
| #18 | Free supplements | Maps to Free Tracking — keep; near done locally |
| #20 | Per-athlete meal plan | Superseded by **P0-SAFE-01** + **P1-NUT-*** (unsafe presets) |
| #21 | Today brief adjusts plan | Maps to **P1-REC-*** |
| #22 | Week report to human | Maps to **P2-HUM-*** |
| #23 | InBody perk | P3 commercial partnership — keep |
| #24 | Billing SKUs | Maps to **P3-BILL-*** |
| #7 | Live coach provider | Maps to **P1-AI-01** |
| #13 | Saudi hosting / PDPL | Maps to **P0-PRIV-*** |

---

## P0 — Engineering truth, privacy, safety

### P0-AUDIT-01 — Repository truth & recoverable baseline
- **Priority:** P0 · **Owner:** Eng · **State:** REVIEW  
- **Scope:** Document dirty tree vs `origin/master`; list migrations 0001–0020; confirm build/test commands.  
- **Acceptance:** This file + gap matrix accurate; domain tests green; recoverable remote baseline.  
- **Evidence:** Backup branch `backup/dirty-tree-2026-10-17` @ `0a45fdd`; inventory `DIRTY_TREE_INVENTORY.md`; `origin/master` @ `84f5639`.  
- **Privacy/safety:** None beyond honesty. **Remaining:** Logical slice PRs from backup → master with per-slice tests.

### P0-SAFE-01 — Quarantine universal cut deficits
- **Priority:** P0 · **Owner:** Domain + Nutrition SME · **State:** REVIEW  
- **Files:** `meal-plan.ts`, `targets.ts`, `fromProfile.ts`, `member/store.ts`, `energy-policy-gate.test.ts`  
- **Scope:** Mark `CUT_DEFICIT_BY_PACE` as unapproved; block apply paths; bypass-matrix tests; free tracking preserved.  
- **Acceptance:** Paid path cannot apply sprint deficit without `policyApproved` gate; docs reference SME review.  
- **Tests:** Domain gate suite + mobile free onboarding estimate + API integration `ENERGY_POLICY_UNAPPROVED`.  
- **Safety:** HIGH · **Remaining for VERIFIED:** SME sign-off only (apply paths audited; proposals `mayAutoApply: false`).

### P0-DATA-01 — Personal/sensitive data inventory
- **Priority:** P0 · **Owner:** Eng + Privacy · **State:** REVIEW  
- **Scope:** Inventory columns/tables touching health-ish data; purposes; retention.  
- **Acceptance:** Inventory table in `data-flow-and-privacy.md` appendix.  
- **Evidence:** Appendix A added 2026-10-17. Retention/legal basis still TBD (P0-PRIV-01).  
- **Privacy:** Required before expansion of AI context.

### P0-PRIV-01 — Consent & legal-basis design
- **Priority:** P0 · **Owner:** Product + Counsel · **State:** BACKLOG  
- **Depends:** Counsel engagement (BLOCKED until named).  
- **Scope:** Schema for consent ledger; purposes; not “consent for everything.”  
- **Acceptance:** Signed design; no claim of PDPL compliance without counsel.  
- **Maps:** #13.

### P0-BOUND-01 — Coaching service boundary
- **Priority:** P0 · **Owner:** Product · **State:** READY  
- **Files:** `docs/product/coaching-service-model.md`  
- **Scope:** Explicit free vs AI vs Coach capabilities; non-claims.  
- **Acceptance:** Doc reviewed by product owner.

### P0-DOC-01 — Vision docs land in repo
- **Priority:** P0 · **Owner:** Eng · **State:** DONE  
- **Scope:** vision, service model, target architecture, data-flow, decision engine, human ops, entitlements, safety tests, release gates, this master TODO.  
- **Acceptance:** Files present under `docs/`; GitHub org issues linked.  
- **Evidence:** `24327cf` on `origin/master`; issues #25–#34 on org project.

---

## P1 — Coaching intelligence foundation

| ID | Title | State | Notes |
| --- | --- | --- | --- |
| P1-STATE-01 | MemberState engine from validated observations | IN_PROGRESS | Domain foundation + tests; API wire next |
| P1-EVT-01 | Consistent MemberEvent model / idempotent writes | BACKLOG | Align with existing tables first |
| P1-POL-01 | Versioned evidence/policy registry | BACKLOG | Replaces ad-hoc constants |
| P1-REC-01 | Recommendation state machine + versioned apply | BACKLOG | Supersedes silent edits; maps #21 |
| P1-AI-01 | Yazan tool gateway (typed tools, minimal context) | BACKLOG | Maps #7 |
| P1-NUT-01 | Individualized energy policy (post SME) | BACKLOG | After P0-SAFE-01 |
| P1-TEST-01 | Safety suite S-01…S-09 executed | BACKLOG | `coaching-safety-tests.md` |

**Exit:** Explainable constrained recommendations without free-form invent.

---

## P2 — Human coaching operations

| ID | Title | State | Maps |
| --- | --- | --- | --- |
| P2-HUM-01 | Weekly survey UX completeness | BACKLOG | #22 / week-report |
| P2-HUM-02 | Structured weekly packet (dashboard object, not PDF-only) | BACKLOG | |
| P2-HUM-03 | Coach dashboard + assignment queue | BACKLOG | |
| P2-HUM-04 | Approve/reject/edit + member feedback delivery | BACKLOG | |
| P2-HUM-05 | Access audit + overdue/escalate | BACKLOG | |
| P2-HUM-06 | Workload metrics for pilots | BACKLOG | |

**Exit:** Real coach completes loop without DB access.

---

## P3 — Commercial & mobile integration

| ID | Title | State | Maps |
| --- | --- | --- | --- |
| P3-BILL-01 | Entitlement service + StoreKit verification | BACKLOG | #24, #11 |
| P3-UX-01 | Home = coaching actions, not dashboard clutter | BACKLOG | |
| P3-UX-02 | Coach feedback inbox (human vs AI labeled) | BACKLOG | |
| P3-UX-03 | Notifications for review due / feedback | BACKLOG | |
| P3-PART-01 | InBody / Ideal Weight perk | BACKLOG | #23 |
| P3-OPS-01 | Export/delete account experiences | BACKLOG | |

**Exit:** Paid member receives advertised service through product flows.

---

## P4 — Controlled pilot

| ID | Title | State |
| --- | --- | --- |
| P4-PIL-01 | Consenting adult pilot protocol | BACKLOG |
| P4-PIL-02 | Reliability / review turnaround / cost dashboards | BACKLOG |
| P4-PIL-03 | Recommendation audit sample | BACKLOG |

---

## Highest-risk next implementation order

1. **P0-SAFE-01** — quarantine unsafe deficits  
2. **P0-DOC-01** — finish doc + org board sync  
3. **P0-DATA-01** — data inventory  
4. **P1-STATE-01** / **P1-REC-01** — state + recommendations  
5. **P2-HUM-03** — coach dashboard  

Do not rewrite working auth, diary, or session logging without verified regression.
