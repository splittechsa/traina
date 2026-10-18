# Traina — Product completion matrix (release audit)

**Updated:** 2026-10-18  
**Master:** includes merged PR #43 (`a2d7011`) — real training adaptation apply  
**Merged:** PR #43 (adaptation apply) + PR #44 (entitlements / membership / landing / supplements)  
**Open follow-on:** Yazan tool resolver + www sections (`product/yazan-tools-and-www`)  
**Backup:** `backup/dirty-tree-2026-10-17` preserved  

Legend: **V** verified · **I** implemented · **P** polish · **W** partial · **M** missing · **B** blocked · **U** unsafe to claim production-ready

---

## A. Mobile screens (Expo Router)

| Screen / route | Status | Loading / empty / error | Nav | Notes |
| --- | --- | --- | --- | --- |
| `index` gate | **I** | — | redirects | Auth/onboarding gate |
| `(auth)/login` | **I** | errors localized | stack | Device QA still **M** |
| `(auth)/register` | **I** | validation | stack | |
| `(auth)/verify` | **I** | | stack | |
| `(auth)/recover` / `reset` | **I** | | stack | |
| `(auth)/diagnostics` | **W** | | stack | Dev-oriented |
| `(onboarding)/index` | **W** | | | Re-onboarding / safety screening incomplete |
| `(tabs)/home` | **I** | skeleton / offline / error | tabs | Coaching signal cards (feedback, recs, notifications) |
| `(tabs)/training` | **I** | loading / error | tabs | Adaptation overlay via program versions |
| `(tabs)/nutrition` | **I** | | tabs | ENERGY_POLICY blocks paid adaptations (**B**) |
| `(tabs)/coach` (Yazan) | **W** | empty / provider / timeout | tabs | Gemini live; tool eval suite **M** |
| `(tabs)/progress` | **W** | | tabs | Trend explanations thin |
| `(tabs)/community` | **W** | empty honest | tabs | |
| `workout/[id]` | **I** | | back | Reflects adapted sets after apply |
| `weekly-checkin` | **I** | | back | Honest Yazan-only vs human queue |
| `food-log` | **I** | | back | |
| `exercises` | **I** | | close | |
| `macros` | **I** | | back | |
| `weight` | **I** | empty / error | back | |
| `activity` | **I** | | back | |
| `progress` (stack) | **W** | | back | Duplicate of tab surface |
| `notifications` | **I** | empty / error | back | In-app only; push **M** |
| `membership` | **I** | loading / retry | back | Server entitlements; purchases off |
| `help` | **I** | | back | FAQ + contact; no live desk |
| `account` | **W** | | | Logout / delete present; export thin |
| `settings` | **I** | | | Locale restart honesty |
| `supplements` | **I** | loading / empty / error | back | Wired to `/v1/supplements` (personal list) |
| `gyms` | **I** | inline notice | back | Referral code |
| `scanner` | **W** | empty honest | back | Barcode/analysis not configured |
| `scanner` meal photo | **W** | | | Same limitation |

---

## B. Backend / services

| Service | Status | Notes |
| --- | --- | --- |
| Auth sessions | **I** | Register/verify/login/refresh/logout/delete |
| Member state + recommendations | **I** | Lifecycle + generate |
| Training adaptation apply | **V** (API) | PR #43 merged; IDOR/self-approve fixed; device UX still open |
| Nutrition program mutate | **B** | ENERGY_POLICY |
| Yazan `/v1/coach/messages` | **I**/**W** | Timeouts + daily quota + authorized tool resolver; eval suite still **M** |
| Weekly brief + human queue | **I** | Entitlement/assignment gate |
| Coach ops APIs | **I** | Claim/feedback/notes/workload |
| Entitlements `GET /v1/member/entitlements` | **I** | Free projection; purchases disabled |
| Billing verify | **M**/501 | Store verifiers not configured |
| Workers / queues | **M** | Empty package |
| Admin / support / gym portals | **M**/stub | |

---

## C. Coach Workspace (web)

| Surface | Status | Notes |
| --- | --- | --- |
| Login / role | **I** | |
| Inbox / claim / review | **I** | Synthetic evidence in `docs/evidence/p2-coaching` |
| Feedback → member notifications | **I** | |
| Supervisor / reassignment | **W** | Thin |
| Visual polish vs Traina brand | **P** | |

---

## D. Public web (`apps/www`)

| Page | Status | Notes |
| --- | --- | --- |
| Arabic landing | **W** | Draft; no fake social proof |
| English landing | **W** | |
| Privacy / terms | **W** | Explicit legal drafts — not counsel-approved |
| Pricing checkout | **M** | Gateway **M**; Apple policy **B** |
| SEO / OG full pack | **W** | Basic meta only |

---

## E. Brand / design system

| Asset | Status | Notes |
| --- | --- | --- |
| Color + type tokens | **I** | `apps/mobile/src/theme/tokens.ts` |
| Mark (SVG path) | **I** | `TrainaMark` + `apps/www/brand/traina-mark.svg` |
| App icon / splash pack | **W** | New generated icon staged; Expo splash config incomplete |
| Component library | **W** | kit exists; not fully systematized |
| RTL / a11y | **W** | Partial; needs device audit |

---

## F. Release gates (non-bypass)

| Gate | Status |
| --- | --- |
| P0-PRIV PDPL counsel | **B** |
| ENERGY_POLICY SME | **B** |
| P3-APPLE-POLICY | **B** |
| Physical iPhone QA (P2-HUM-09) | **M** |
| Billing sandbox + webhooks | **M** |
| FINAL_PRODUCT_READINESS_REPORT | **M** (not until evidence exists) |

---

## Hard rules

1. Do not claim launch-complete while billing, AI eval, device QA, or blocked gates remain open.  
2. Do not unlock paid nutrition or claim PDPL compliance.  
3. Prefer focused PRs; preserve Neon forward migrations and backup branch.  
4. Screenshots and device claims require real capture — never fabricated.  
