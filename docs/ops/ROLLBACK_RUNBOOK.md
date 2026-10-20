# Rollback runbook

Status: procedure prepared; production rehearsal NOT_TESTED.

- Record the last verified API image/commit, coach portal artifact, Expo channel/runtime and database recovery point before a promotion.
- Stop promotion if readiness/auth checks fail, data isolation changes, workout writes fail or approval gates are bypassed. Disable affected mutations through an existing verified control; do not invent an untested flag.
- Redeploy the previously verified compatible API and web artifacts using the actual hosting provider's controlled release mechanism. That provider and its command are not verified here.
- Do not automatically reverse migrations or delete program versions. Migration 0031 broadens the program version source constraint; older readers must be compatibility-tested before an application rollback. Deleting version history is not a rollback plan.
- For database recovery, first preserve evidence and select an isolated restore target. Validate schema and counts using synthetic or approved data access, then perform a reviewed cutover. Do not reset or restore over the configured production branch without explicit authorization.
- Re-run ready/auth/IDOR, workout save/edit, entitlements and adaptation safety checks. Preserve incident timestamps, affected build identifiers and reconciliation work. Payment refunds and entitlement repair require provider-authoritative reconciliation, never fabricated events.
