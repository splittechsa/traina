# Human coach operations

## Current state

| Capability | Status |
| --- | --- |
| Member weekly survey + packet | Partial — `POST /v1/coach/weekly-brief` → `coach_weekly_briefs.status = queued_for_human` |
| Coach dashboard | **Missing** |
| Assignment / roster / SLA | **Missing** |
| Approve/reject AI recommendations UI | **Missing** |
| Member-visible human feedback inbox | **Missing** |
| Access logs for coach reads | **Missing** |

## Target workflow

```text
WEEKLY_REVIEW_DUE
  → MEMBER_SUBMITTED / AUTO_SUMMARY_READY
  → QUEUED_FOR_HUMAN
  → ASSIGNED → IN_REVIEW → FEEDBACK_SENT → ACKNOWLEDGED / FOLLOW_UP
```

Also: overdue, reassigned, reopened, escalated.

## Dashboard requirements

Assigned roster, review queue, priority/escalation, member timeline, weekly comparison, evidence behind AI drafts, approve/reject/edit, written/voice feedback, clarification requests, messaging, coach notes, follow-ups, completion history, supervisor escalation, workload reporting.

## Controls

- Coaches only see assigned members.
- Access logged.
- Members always know AI vs human.
- No automatic approval impersonating human review.
- Workload measured in pilots — do not assume a fixed coach:member ratio.
