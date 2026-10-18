# PR #49 — Real-device acceptance (2026-10-18)

**Branch:** `ux/mobile-rtl-nutrition-workout`  
**Verdict for physical device demonstration:** **FAIL** (not demonstrated on a connected iPhone or Android in this environment)

## Environment constraints

- Host is Windows; no `adb`, no Android AVD, no `xcrun`/iOS Simulator available in PATH.
- User-supplied screenshots in the acceptance request show **pre-#49** UI markers (text “رجوع” back control, “مزامنة المجموعات” sync button, nutrition without meal-slot sections, weekly title left-aligned without `AppHeader` chevron).
- Those captures therefore cannot be used as after-evidence for the reconstructed build.

## Automated verification (this pass)

| Suite | Result |
| --- | --- |
| Domain unit (`replaceSet`, existing training) | Run in CI/local `npm test -w @sahhti/domain` |
| API integration (set edit PUT, custom meal CRUD + log) | Run in `npm test -w @sahhti/api` |
| Physical iPhone / Android walkthrough | **Not run** — **FAIL** gate |

## Journey PASS/FAIL (code vs device)

| Journey | Code status | Device status |
| --- | --- | --- |
| Home RTL + tab clearance | Improved (`ScreenBody` + `tabBarClearance`) | **FAIL** — no device capture |
| Training / program create | Implemented on branch | **FAIL** — no device capture |
| Active workout + rest timer | Implemented; sync button removed | **FAIL** — no device capture |
| Set logging + edit logged set | POST + PUT replace; mobile tap-to-edit | **FAIL** — no device capture |
| Nutrition meal slots + ready library | Implemented | **FAIL** — no device capture |
| Custom meal create/save/edit/reuse | New `/meal-builder` + API + migration `0029` | **FAIL** — no device capture |
| Yazan coach RTL | Prior #49 work | **FAIL** — no device capture |
| Weekly check-in RTL + localized empty coach | Localized copy; footer flex; textAlign | **FAIL** — no device capture |

## Outstanding defects

1. Real-device evidence missing — do not claim UX complete.
2. Offline edit of logged sets not supported (online PUT only).
3. Custom meal ingredient preview after “load for edit” does not re-fetch per-100 g macros until foods are re-added (save still correct via API).
4. Expo Dev Client blue gear remains in `__DEV__` only (not a production defect).
5. ENERGY_POLICY / Apple / PDPL gates unchanged (**B**).

## Required before PASS

1. Install this branch on a physical iPhone and Android (or Dev Client rebuild).
2. Capture Home, Training, Active Workout, Set Logging, Rest Timer, Nutrition, Meal Library, Custom Meal Builder, Yazan, Weekly Check-in.
3. Re-run journey matrix with side-by-side before (user shots) / after (this build).
