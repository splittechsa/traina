# Incident response runbook

Status: prepared; named on-call ownership, alert routes and incident drill evidence remain open.

1. Assign incident commander, record UTC and Asia/Riyadh times, release/build/commit, impact and scope. Restrict access to incident material; avoid raw health data and tokens in logs.
2. Preserve relevant audit records and deployment/migration identifiers. Determine whether account isolation, coaching approvals, billing, workout durability or availability is affected.
3. Contain with a verified service control or roll back to a verified artifact. Revoke exposed credentials through the responsible provider if an actual exposure is confirmed; coordinate rotation and client recovery.
4. Reconcile pending workout writes by idempotency key and program history. Never discard offline conflicts or mark a payment/coach approval successful without source evidence.
5. Have qualified privacy/legal staff evaluate notification duties for any confirmed personal-data incident. This document does not determine legal deadlines or replace P0-PRIV approval.
6. Verify recovery through synthetic acceptance journeys, restore readiness and monitoring. Record root cause, corrective changes, test evidence and accountable follow-up before closing the incident.
