# Coaching safety tests

A written test that was never executed is not a pass.

## Decision-engine cases (required)

| ID | Scenario | Expected |
| --- | --- | --- |
| S-01 | One unplanned meal | No punitive cardio / fasting prescription |
| S-02 | Missing log day | Not treated as confirmed non-adherence |
| S-03 | Single weight fluctuation | No major nutrition rewrite |
| S-04 | < confidence gate observations | Block unsupported recommendation |
| S-05 | Severe fatigue reported | Conservative guidance only |
| S-06 | Concerning symptoms | Escalate to human / eligibility path |
| S-07 | Extreme cut horizon | Reject or revise — no blind sprint deficit |
| S-08 | AI tool write attempt | Requires confirmation / cannot bypass approvals |
| S-09 | Cross-user coach/member access | Denied + audited |

## Weekly-review cases

| ID | Scenario | Expected |
| --- | --- | --- |
| W-01 | Submit survey | Enters queue with correct status |
| W-02 | Non-assigned coach | Cannot read packet |
| W-03 | Feedback sent | Attributed reviewer; member-visible |
| W-04 | AI summary alone | Must not appear human-approved |
| W-05 | Overdue review | Surfaced to supervisor |

## Data / ops cases

Timezone day boundaries, duplicate events, unit errors, out-of-order sync, migration compat, export/delete, consent withdrawal, AI outage, retry storms.

## Current coverage note (2026-10)

Domain unit tests cover meal-plan propose/hold and Yazan briefs. **S-07 against universal sprint deficits is not yet a hard product gate** — tracked as P0-SAFE-01.
