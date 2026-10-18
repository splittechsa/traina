# Traina — Product completion matrix (release audit)

**Updated:** 2026-10-18  
**Master:** includes #43–#45 + mobile UX reconstruction + offline set edit + Yazan polish  
**Device evidence:** **BLOCKED** (signing/hardware) — see `docs/ops/PR49_DEVICE_ACCEPTANCE.md`  
**Do not** claim mobile UX complete without device evidence.

Legend (product): **V** verified · **I** implemented · **P** polish · **W** partial · **M** missing · **B** blocked · **U** unsafe  

Device legend: **PASS** · **FAIL** · **BLOCKED** · **NOT TESTED** · **PARTIAL**

---

## A. Mobile screens (Expo Router)

| Screen / route | Status | Loading / empty / error | Nav | Notes |
| --- | --- | --- | --- | --- |
| `index` gate | **I** | — | redirects | Auth/onboarding gate |
| `(auth)/*` | **I** | localized | stack | Device **NOT TESTED** |
| `(onboarding)/index` | **W** | | | Safety screening incomplete |
| `(tabs)/home` | **I** | skeleton / offline / error | tabs | Extra tab clearance |
| `(tabs)/training` | **I** | loading / error | tabs | Program versions |
| `(tabs)/nutrition` | **I** | meal slots + ready library | tabs | Meal builder entry |
| `(tabs)/coach` (Yazan) | **I**/**W** | quota / tool note / retry | tabs | History refetch; Arabic bubbles |
| `(tabs)/progress` | **W** | | tabs | |
| `workout/[id]` | **I** | set table + rest + offline edit | back | PUT replace; rest persist |
| `weekly-checkin` | **I** | RTL + localized coach empty | back | |
| `meal-builder` | **I** | | back | Custom meal CRUD |
| `food-log` / `exercises` / `macros` | **I** | | | |
| `account` | **I** | | | Export + delete (no secrets in export) |
| `membership` | **I** | | | Purchases off |
| `scanner` | **W** | honest empty | | |

---

## A2. Device journey gates

| Journey | Code | Device |
| --- | --- | --- |
| Home | **I** | **BLOCKED** |
| Training / program | **I** | **BLOCKED** |
| Active workout + rest | **I** | **BLOCKED** |
| Set log / edit / offline | **I** (auto tests PASS) | **BLOCKED** |
| Nutrition + ready meals | **I** | **BLOCKED** |
| Custom meals | **I** (API PASS) | **BLOCKED** |
| Yazan | **I**/**W** | **BLOCKED** |
| Weekly check-in | **I** | **BLOCKED** |

---

## B. Backend / services

| Service | Status | Notes |
| --- | --- | --- |
| Auth sessions | **I** | |
| Account export `GET /v1/account/export` | **I** | No passwords/tokens |
| Account delete | **I** | Soft delete |
| Push device register | **I**/**W** | Tokens stored; delivery **M** |
| Training set replace | **I** | PUT + offline reconcile |
| Custom meals | **I** | Migration `0029` |
| Entitlements | **I** | Free projection; purchases off |
| Yazan messages + quota | **I** | Daily quota in GET history |
| Nutrition mutate | **B** | ENERGY_POLICY |
| Billing verify | **M**/501 | |
| Workers | **M** | |

---

## C–E. Coach web / www / brand

| Area | Status | Notes |
| --- | --- | --- |
| Coach Workspace | **I**/**P** | Polish continues independently |
| `apps/www` | **W** | Landing drafts; no fake proof |
| Design tokens / RTL | **I**/**W** | Device audit **BLOCKED** |

---

## F. Release gates (non-bypass)

| Gate | Status |
| --- | --- |
| P0-PRIV PDPL counsel | **B** |
| ENERGY_POLICY SME | **B** |
| P3-APPLE-POLICY | **B** |
| Physical device QA | **BLOCKED** (signing/hardware) |
| Billing sandbox | **M** |
| AI eval suite | **W** (scaffold / expand) |
| FINAL readiness report | **M** |

---

## Hard rules

1. Do not freeze unrelated engineering while device QA is BLOCKED.  
2. Do not mark reconstructed mobile UX complete without device evidence.  
3. Do not enable live billing or real sensitive-data processing before approvals.  
4. Screenshots require real capture — never fabricated.  
