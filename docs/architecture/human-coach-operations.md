# Human coach operations

## Current state

| Capability | Status |
| --- | --- |
| Member weekly survey + packet | Shipped — `POST /v1/coach/weekly-brief` queues `weekly_review_queue` |
| Coach assignment (admin/supervisor) | Shipped — `POST/DELETE /v1/coach/assignments` |
| Coach Workspace web app | Shipped — `apps/coach-portal` |
| Approve/reject AI recommendations | Shipped — `POST /v1/coach/members/:id/recommendations/:id/decide` |
| Member-visible human feedback | Shipped — `GET /v1/member/coach-feedback` |
| Access logs for coach reads | Shipped — `coach_access_audit` + assignment events |
| Coach-share consent ledger | Shipped — runtime only; **P0-PRIV legal basis still blocked** |

## Target workflow

```text
WEEKLY_REVIEW_DUE
  → MEMBER_SUBMITTED / AUTO_SUMMARY_READY
  → QUEUED_FOR_HUMAN
  → ASSIGNED → IN_REVIEW → FEEDBACK_SENT → COMPLETED
```

Also: overdue, reassigned, reopened, escalated, failed.

## Controls

- Assignments: admin or `coach_supervisor` only. No self-assignment / self-promotion.
- Coaches only see assigned members **and** members who granted coach-share consent.
- Access denied responses are uniform (`FORBIDDEN` / “Access denied”) — no existence or health leakage.
- Assignment and review transitions append to immutable event tables.
- Members always know AI vs human (`authorKind: human_coach`; feedback labeled non-Yazan).
- No automatic approval impersonating human review.
- Nutrition remains propose-only while `ENERGY_POLICY.approvedForPaidCoaching === false`.
- Workload metrics exposed at `GET /v1/coach/workspace/metrics`.
