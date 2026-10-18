# Physical device acceptance package (PR #49+)

**Final device acceptance remains BLOCKED** until evidence is attached. Do not mark mobile UX complete without it.

## Legend

| State | Meaning |
| --- | --- |
| **PASS** | Verified with required evidence |
| **FAIL** | Tested and failed |
| **BLOCKED** | Cannot execute (signing, hardware, external approval) |
| **NOT TESTED** | Verification not yet performed |
| **PARTIAL** | Some scenarios verified only |

## Screens to capture

For each: screenshot, navigation, RTL, interaction, loading/error, network recovery, persistence, a11y.

| Screen | Code | Device |
| --- | --- | --- |
| Home | I | BLOCKED / NOT TESTED |
| Training | I | BLOCKED / NOT TESTED |
| Active workout | I | BLOCKED / NOT TESTED |
| Set logging | I | BLOCKED / NOT TESTED |
| Rest timer | I | BLOCKED / NOT TESTED |
| Nutrition | I | BLOCKED / NOT TESTED |
| Meal library | I | BLOCKED / NOT TESTED |
| Custom meal builder | I | BLOCKED / NOT TESTED |
| Yazan | I/W | BLOCKED / NOT TESTED |
| Weekly check-in | I | BLOCKED / NOT TESTED |

## Workout resilience checklist

- [ ] Local persistence of pending sets
- [ ] Offline log + offline edit
- [ ] Reconnect flush (POST / PUT)
- [ ] Duplicate prevention (same set id)
- [ ] Conflict on completed session
- [ ] Rest timer survives background
- [ ] Pause / resume / safe complete

## After evidence

1. Store captures in `docs/evidence/pr49-device/`
2. Update this table to PASS/FAIL/PARTIAL
3. Fix defects; rerun affected automated + device tests
4. Only then flip PRODUCT_COMPLETION_MATRIX device gates
