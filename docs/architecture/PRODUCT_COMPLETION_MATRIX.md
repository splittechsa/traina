# Traina — Product completion matrix (Phase 0)

**Audit date:** 2026-10-18  
**Git HEAD (working):** `p1/real-training-adaptation` @ `0504712`  
**PR #43:** https://github.com/splittechsa/traina/pull/43 — OPEN, CI green, **human review still required (do not merge without it)**  
**Backup:** `backup/dirty-tree-2026-10-17` preserved  

Legend: **V** verified · **I** implemented needs integration · **P** polish · **W** partial · **M** missing · **B** blocked · **U** unsafe for production claims

| Area | Status | Notes |
| --- | --- | --- |
| Auth register/login/verify/recover/reset | **I** | API + mobile auth screens; needs device QA |
| Session persistence | **I** | SessionProvider; expiry UX polish |
| Onboarding | **W** | Present; re-onboarding / safety screening incomplete |
| Home today coaching surface | **W** | Exists; pending recs / human feedback prominence uneven |
| Training programs + workout execution | **I** | Catalog, start-day, sets; adaptation overlay wired in PR #43 |
| Real training recommendation apply | **I** → awaiting **V** | Atomic apply + tests; **not VERIFIED until PR #43 merge + review** |
| Exercise library / scanner | **I** | Needs licensed media audit |
| Nutrition logging / meal plans | **I** | ENERGY_POLICY blocks paid adaptations (**B** for full adaptive nutrition) |
| Progress / weight / measurements | **W** | Screens exist; trend explanations incomplete |
| Daily check-in (Yazan) | **W** | API + coach tab; provider live via Gemini env smoke |
| Weekly check-in + human feedback | **I** | Portal evidence yes; **physical iPhone evidence still M** |
| Notifications (in-app) | **I** | 0026 + screen; push channel **M** |
| Membership / entitlements UI | **I** | `GET /v1/member/entitlements` + membership screen; purchases still off |
| Settings / account / logout | **W** | Help FAQ filled; purchase/support desk still limited |
| Coach Workspace | **I** | Ops loop proven synthetically; supervisor tools thin |
| Yazan production AI | **W** | Gemini configured; tool orchestration partial; eval suite **M** |
| Website landing + checkout | **W** | `apps/www` Arabic/EN draft; checkout **M**; legal pages draft only |
| Billing gateway / webhooks | **M** | Entitlement domain only |
| Apple IAP / policy | **B** | P3-APPLE-POLICY |
| Admin / support / gym portals | **M**/stub | Folders exist empty or legacy |
| Workers / job queues | **M** | `services/workers` empty |
| P0-PRIV PDPL | **B** | Counsel |
| ENERGY_POLICY nutrition apply | **B** | Scientific review |
| Design system / logo / brand | **W** | Tokens + IBM Plex Arabic; no formal logo pack |
| Navigation regression tests | **M** | |
| Physical device QA pack | **M** | PR #43 / P2 exit blocker for mobile claims |
| Staging/prod release automation | **W** | CI api+mobile; full release checklist incomplete |

## Hard rules for this program

1. Do **not** bypass PR #43 human review.  
2. Do **not** claim paid nutrition adaptations or PDPL compliance.  
3. Do **not** mark device journeys VERIFIED without physical screenshots.  
4. Prefer focused PRs over one mega-PR.  
5. Preserve backup branch and Neon migrations 0025–0027 forward-only.

## Immediate eligible implementation (post–Phase 0)

1. Surface real entitlements on membership screen + `GET /v1/member/entitlements`.  
2. Replace help/support empty shell with honest support content.  
3. Navigation/back consistency on stack screens.  
4. Landing page scaffold (Arabic-first) without fake social proof.  
5. Continue Yazan tool context + failure handling without exposing secrets.  
