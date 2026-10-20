# Traina — Product completion matrix (release audit)

**Updated:** 2026-10-18  
**Master:** `99063d5` (includes #43–#45)  
**Open closure PRs:** #46 Wave 1 · #47 Wave 2 · Wave 3–5 ops/report (this branch)  
**Readiness:** see `FINAL_PRODUCT_READINESS_REPORT.md` — **NO-GO**

Legend: **V** verified · **I** implemented · **P** polish · **W** partial · **M** missing · **B** blocked · **U** unsafe to claim production-ready

---

## A. Mobile screens (Expo Router)

| Screen / route | Status | Notes |
| --- | --- | --- |
| `(tabs)/home` | **I** | Coaching signals; entitlement-aware human feedback (#46) |
| `(tabs)/coach` (Yazan) | **I**/**W** | Live tools + eval (#47); device QA still **M** |
| `weekly-checkin` | **I** | Human queue gated by server entitlements |
| `membership` | **I** | Server entitlements; purchases off |
| `notifications` | **I**/**W** | In-app + honest push registration (`deliveryConfigured: false`) |
| `account` | **I** | Logout / delete / export |
| `privacy` | **I** | Coach-share consent grant/withdraw |
| `scanner` | **W** | Barcode/analysis not configured |

---

## B. Backend / services

| Service | Status | Notes |
| --- | --- | --- |
| Entitlements | **I** | Free projection; purchases disabled |
| Account export | **I** | Facts only; PDPL packaging **B** |
| Push device registry | **W** | Migration `0029`; delivery not configured |
| Billing verify | **M**/501 | Store verifiers missing |
| Yazan eval suite | **I** (domain + provider) | #47 |
| ENERGY_POLICY nutrition apply | **B** | |

---

## C. Coach Workspace

| Surface | Status | Notes |
| --- | --- | --- |
| Inbox / claim / review | **I** | |
| Follow-ups / mark-overdue | **I** | #46 |
| Brand alignment | **P**/**I** | Shared Traina tokens + IBM Plex |

---

## D. Public web (`apps/www`)

| Page | Status | Notes |
| --- | --- | --- |
| Landing ar/en | **W** | No fake social proof |
| Privacy / terms | **W** | Legal drafts — counsel **B** |
| robots / sitemap / OG | **I** | Wave 3 |
| Pricing checkout | **M** | Gateway **M**; Apple **B** |

---

## E. Brand / design system

| Asset | Status | Notes |
| --- | --- | --- |
| Tokens (mobile + package + www + coach) | **I** | Forest `#315C49` / gold `#D6A54A` / paper |
| Mark SVG | **I** | |
| App icon / splash | **W** | Config present; device verify **M** |
| RTL | **W** | Needs device audit |

---

## F. Release gates (non-bypass)

| Gate | Status |
| --- | --- |
| P0-PRIV PDPL counsel | **B** |
| ENERGY_POLICY SME | **B** |
| P3-APPLE-POLICY | **B** |
| Billing sandbox + webhooks | **M** |
| Remote push delivery | **M** (registry only) |
| Physical iPhone/Android QA | **M** |
| FINAL_PRODUCT_READINESS_REPORT | **I** — decision **NO-GO** |

---

## Hard rules

1. Do not claim launch-complete while billing, device QA, or blocked gates remain open.  
2. Do not unlock paid nutrition or claim PDPL compliance.  
3. Prefer focused PRs; never fabricate screenshots or purchase flows.  
