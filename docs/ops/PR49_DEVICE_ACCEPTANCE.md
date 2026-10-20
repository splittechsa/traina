# PR #49 — Device acceptance status

**Branch work through:** `4518b83` + follow-on offline/Yazan/ops commits  
**Final device acceptance:** **BLOCKED** (no Apple signing / no connected phone or ADB on the engineering host)

## State legend

| State | Meaning |
| --- | --- |
| PASS | Verified with required evidence |
| FAIL | Tested and failed |
| BLOCKED | Cannot execute due to external dependency |
| NOT TESTED | Not yet performed |
| PARTIAL | Some scenarios only |

## Journey matrix

| Journey | Automated / code | Device |
| --- | --- | --- |
| Home RTL + tab clearance | PARTIAL (unit/UI code) | BLOCKED |
| Training / program templates | PASS (catalog + activate + customize + start-day API) | BLOCKED |
| Program edit + smart substitutions | PASS (API + domain ranking) | BLOCKED |
| Exercise library + 3D MovementDemo | PARTIAL (procedural demo in UI) | BLOCKED |
| Active workout + rest | PARTIAL (rest persist + tests) | BLOCKED |
| Set log / edit / offline reconcile | PASS (domain + API + queue tests) | BLOCKED |
| Nutrition + ready meals | PARTIAL | BLOCKED |
| Custom meal workflow | PASS (API integration) | BLOCKED |
| Yazan contextual presence | PARTIAL (cards on home/training/nutrition/progress/workout/weekly + seed prompts) | BLOCKED |
| Weekly check-in | PARTIAL | BLOCKED |

User-supplied screenshots remain **before** evidence (pre-reconstruction build). They are not FAIL of the new build.

## External blockers for device PASS

1. Apple Developer credentials + EAS iOS signing (or TestFlight)
2. Physical iPhone install of development/preview build
3. Android install (EAS APK) and/or working ADB
4. Staging API reachable from devices (`EXPO_PUBLIC_API_URL`)

See `docs/ops/EAS_DEVICE_QA.md` and `docs/ops/DEVICE_ACCEPTANCE_PACKAGE.md`.
