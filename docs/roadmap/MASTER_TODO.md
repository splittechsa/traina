# Traina Master TODO

**Baseline:** `origin/master` @ `84f5639` · recoverable work `backup/dirty-tree-2026-10-17` @ `0a45fdd` · active `p0/safety-gap-and-baseline`.  
**Audit date:** 2026-10-17  
**Org board:** GitHub project “Gym App” + issues #25–#34 (`vision-2026`); billing #35–#38.  
**Commercial decision:** Website-first subscription sales via external payment gateway; server-authoritative entitlements; Apple IAP as addable channel (see `subscription-and-entitlements.md`).

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
| Weekly brief queued_for_human | **Existing** | Queue + Coach Workspace inbox |
| Evidence / policy registry | **Missing** | — |
| Recommendation state machine + versioned apply | **Partial** | Domain SM + generate/advance/apply/monitor/expire/dedupe (0025); nutrition APPLIED blocked |
| Human coach ops UI | **Existing** | `apps/coach-portal` — iPhone member evidence still open |
| Consent ledger | **Partial** | Coach-share consent shipped; full PDPL ledger **P0-PRIV BLOCKED** |
| MemberState engine | **Existing** | Domain + `GET /v1/member/state` + Yazan tool |
| Store / web entitlements | **Partial** | Domain subscription helpers; no gateway, no entitlement service, no StoreKit |
| Landing page checkout | **Missing** | Website-first sales decision — see P3-WEB-* |
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
| #24 | Billing SKUs | Superseded by **P3-WEB-*** + **P3-APPLE-*** + **P3-ENT-*** (keep open as pointer) |
| #7 | Live coach provider | Maps to **P1-AI-01** |
| #13 | Saudi hosting / PDPL | Maps to **P0-PRIV-*** |
| #34 | Entitlements + store verification | Maps to **P3-ENT-01** / **P3-APPLE-IAP-01** |

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
| P1-STATE-01 | MemberState engine from validated observations | REVIEW | Clean PR slice (no mobile redesign); GET /v1/member/state + Yazan |
| P1-EVT-01 | Consistent MemberEvent model / idempotent writes | REVIEW | RawMemberEvent normalize over existing tables |
| P1-POL-01 | Versioned evidence/policy registry | BACKLOG | Replaces ad-hoc constants |
| P1-REC-01 | Recommendation state machine + versioned apply | REVIEW | Engine + generate/advance; nutrition apply blocked |
| P1-REC-02 | Expire/dedupe/prioritize/apply/monitor/revert + safety class | REVIEW | Migration `0025`; not VERIFIED until merged |
| P1-REC-03 | Training adaptation kinds (bounded) | REVIEW | recovery / deload / progressive_overload_hint |
| P1-REC-04 | Real program version apply + before/after + idempotent audit | REVIEW | Migration `0027`; concurrent/idempotent/workout evidence in PR #43 hardening — **not VERIFIED until merge** |
| P1-AI-01 | Yazan tool gateway (typed tools, minimal context) | IN_PROGRESS | Missing-data, daily/weekly prep, draft, escalate, navigate |
| P1-NUT-01 | Individualized energy policy (post SME) | BLOCKED | After P0-SAFE-01 + SME |
| P1-TEST-01 | Safety suite S-01…S-09 executed | BACKLOG | `coaching-safety-tests.md` |

**Exit:** Explainable constrained recommendations without free-form invent.

---

## P2 — Human coaching operations

| ID | Title | State | Maps |
| --- | --- | --- | --- |
| P2-HUM-00 | Coach assignment + review queue + access audit (backend) | DONE | migrations 0022–0023; admin/supervisor assign only |
| P2-HUM-01 | Weekly survey UX completeness | DONE | `apps/mobile/app/weekly-checkin.tsx` (status labels, a11y, AR/EN) |
| P2-HUM-02 | Structured weekly packet (dashboard object, not PDF-only) | DONE | `buildAuthorizedCoachPacket` + review packet API |
| P2-HUM-03 | Coach dashboard + assignment queue | DONE | `apps/coach-portal` + 20s refresh |
| P2-HUM-04 | Approve/reject/edit + member feedback delivery | DONE | coach decide + feedback endpoints |
| P2-HUM-05 | Access audit + overdue/escalate | DONE | audit events + escalate + mark-overdue |
| P2-HUM-06 | Workload metrics for pilots | DONE | `/v1/coach/workspace/metrics` + measured claim→feedback ms |
| P2-HUM-07 | Yazan reads human feedback + recommendation state | DONE | `getHumanCoachFeedback` / `getRecommendationStatus` |
| P2-HUM-08 | Cohort ops validation (multi member/coach) | DONE | `human-coach-cohort-runtime.json` — 3×2 cohort; mean claim→feedback 5763ms (API only) |
| P2-HUM-09 | Physical iPhone Expo walkthrough screenshots | IN_PROGRESS | Expo `:8081` up; **device screenshots still required** |
| P2-HUM-10 | Coach Workspace UI evidence pack | DONE | `docs/evidence/p2-coaching/01–04` login→inbox→desk→completed |
| P2-HUM-11 | Member confirm/apply permitted recommendations in weekly UI | IN_PROGRESS | `weekly-checkin.tsx` confirm + apply; nutrition blocked |

**Exit:** Synthetic member weekly check-in on iPhone + coach portal feedback + member sees human identity — UI evidence required (not API-only). **Portal half proven; iPhone half still open.**

**Baseline:** PR #41 merge `ff2bb87`; PR #42 evidence merge `deb009d`; dirty-tree backup `backup/dirty-tree-2026-10-17` retained. Readiness branch: `p2/coaching-experience-readiness`.

---

## P2/P3 — WEB BILLING & SUBSCRIPTION ENTITLEMENTS

**Decision:** Landing-page primary sales + external gateway; unified Traina account entitlements on all clients.  
**Hard rules:** No PAN/CVV storage; no client-side paid unlock; billing must not bypass P0 safety/privacy gates; no prohibited iOS external-purchase CTAs.  
**Architecture:** `docs/architecture/subscription-and-entitlements.md`

### Entitlement core (channel-agnostic)

| ID | Title | State | Acceptance |
| --- | --- | --- | --- |
| P3-ENT-01 | Server entitlement service (plans → capabilities) | IN_PROGRESS | Domain `projectEntitlements` + capability gate; API wire next |
| P3-ENT-02 | Schema: plans, prices, customers, checkout sessions, payments, subscriptions, entitlements, usage limits, webhook events, refunds | BACKLOG | Migrations + Zod contracts; idempotent keys |
| P3-ENT-03 | Usage limits (AI fair-use, review quotas) | BACKLOG | Enforced server-side; over-limit fails closed |
| P3-ENT-04 | Billing audit log + reconciliation reports | BACKLOG | Every grant/revoke attributable; daily reconcile job sketch |
| P3-ENT-05 | Unauthorized entitlement mutation tests | BACKLOG | Cross-user / forged client / unsigned webhook rejected |

### Website + payment gateway

| ID | Title | State | Acceptance |
| --- | --- | --- | --- |
| P3-WEB-01 | Landing page pricing + plan presentation | BACKLOG | Matches service model Free / AI / Coach |
| P3-WEB-02 | Register/purchase on website into same Traina identity | BACKLOG | One account; entitlements visible on mobile after purchase |
| P3-WEB-03 | Payment gateway provider abstraction | BACKLOG | Swappable adapter; no card data in our DB |
| P3-WEB-04 | Hosted checkout / secure payment components | BACKLOG | PCI scope stays with provider |
| P3-WEB-05 | Server-side checkout/payment verification | BACKLOG | Entitlement only after verified success |
| P3-WEB-06 | Signed webhook validation + replay protection | BACKLOG | Bad signature / replay → no state change |
| P3-WEB-07 | Subscription lifecycle (renew, cancel, expiry, failed payment, grace, refund) | BACKLOG | Domain transitions + persistence match |
| P3-WEB-08 | Invoice + Saudi tax/VAT handling | BACKLOG | Counsel-approved; engineering implements approved rules only |
| P3-WEB-09 | Customer billing portal | BACKLOG | Invoices, cancel, payment method via provider |
| P3-WEB-10 | Billing verification suite | BACKLOG | Success, duplicate/delayed webhooks, failed renewals, refunds, expiry, concurrency, reconciliation |

### Apple-compliant mobile channel

| ID | Title | State | Acceptance / blocker |
| --- | --- | --- | --- |
| P3-APPLE-POLICY-01 | Counsel + App Review strategy for §§3.1.1 / 3.1.3 | BACKLOG | **BLOCKED** until written policy sign-off; no guesswork |
| P3-APPLE-IAP-01 | StoreKit IAP as second channel into same entitlements | BACKLOG | Same plans/entitlements; Apple price SKUs; server receipt verify |
| P3-APPLE-UX-01 | iOS upgrade UX without prohibited external checkout links | BACKLOG | No bypass buttons/redirects/misleading prompts |
| P3-APPLE-P2P-01 | Evaluate live person-to-person coaching exception separately | BACKLOG | Must **not** auto-classify Traina Coach (async review + AI) as exempt |

Maps: epic **#35**; schema **#36**; web checkout **#37**; Apple policy **#38**. Supersedes narrow reading of #24 / #34 (keep as pointers).

**Exit (billing):** Website purchase grants server entitlements; mobile reflects them; Apple path designed without schema redesign; App Store submission not claimed ready until **P3-APPLE-POLICY-01** VERIFIED.

---

## P3 — Commercial & mobile integration (non-billing)

| ID | Title | State | Maps |
| --- | --- | --- | --- |
| P3-BILL-01 | *(superseded)* Entitlement + StoreKit — see **P3-ENT-*** / **P3-APPLE-*** / **P3-WEB-*** | SUPERSEDED | #24, #34 |
| P3-UX-01 | Home = coaching actions, not dashboard clutter | BACKLOG | |
| P3-UX-02 | Coach feedback inbox (human vs AI labeled) | IN_PROGRESS | weekly-checkin + notifications authorKind |
| P3-UX-03 | Notifications for review due / feedback | IN_PROGRESS | migration 0026 + `/v1/member/notifications` |
| P3-PART-01 | InBody / Ideal Weight perk | BACKLOG | #23 |
| P3-OPS-01 | Export/delete account experiences | BACKLOG | |

**Exit:** Paid member receives advertised service through product flows **and** passes billing + App Store policy gates above.

---

## P4 — Controlled pilot

| ID | Title | State |
| --- | --- | --- |
| P4-PIL-01 | Consenting adult pilot protocol | BACKLOG |
| P4-PIL-02 | Reliability / review turnaround / cost dashboards | BACKLOG |
| P4-PIL-03 | Recommendation audit sample | BACKLOG |

---

## Highest-risk next implementation order

1. Keep **backup/dirty-tree-2026-10-17** recoverable; slice-merge carefully  
2. **P0-SAFE-01** SME + **P0-PRIV-01** counsel (**BLOCKED** externally)  
3. Finish **P1-REC-02/03** + program-service apply for training payloads  
4. **P2-HUM-09** physical iPhone evidence; **P3-UX-03** push channel later  
5. **P1-AI-01** live provider + streaming (still mocked locally)  
6. **P3-ENT-*** / **P3-WEB-*** website billing after privacy design for payment PII  
7. **P3-APPLE-POLICY-01** before any iOS purchase UX  
8. Admin ops platform + workers / staging (Wave 5)

Do not rewrite working auth, diary, or session logging without verified regression.  
Do not mark paid coaching ready until safety, privacy, operational, and App Store gates are evidence-backed.
