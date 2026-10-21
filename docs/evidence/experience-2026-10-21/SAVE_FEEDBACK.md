# Follow-up: save feedback latency — 2026-10-21

Status: implementation and automated verification PASS; renewed physical latency verification BLOCKED by device disconnect. The member reported slow set saves and slow workout completion after the earlier change. Earlier device metrics are not proof that this follow-up is accepted.

Observed code paths:
- A set save awaited durable enqueue, draft removal and a full pending-queue read before updating feedback.
- Completion awaited four query invalidations/refetches in series after the authoritative completion response.
- A second sync request returned false while the first was running. New commands appended during sync could wait for the 15-second retry interval.

Changes:
- Keep the durable SQLite enqueue before feedback, then project the command on the latest query-cache session. Draft cleanup and server synchronization no longer hold the input lock. Local feedback explicitly says “Saved on device · waiting to sync”; server sync success clears it.
- Use the authoritative completion response immediately. Refresh dependent screens in the background, without a redundant session GET. Update the offline completion snapshot and report any local-cache failure without misreporting server completion as failed.
- Share an active sync promise only within the same account/workout. Finish joins that work instead of receiving a false failure. Drain newly appended commands immediately after a successful batch, while stopping on failed/conflicting commands.
- Reuse owned sessions returned by set mutations. Persist the confirmed server snapshot BEFORE acknowledging/deleting queued commands, so an offline reopen retains acknowledged sets.
- Add bounded action-lock, local save feedback, SQLite queue-wait and operation timing events. No tokens, payloads, query parameters or member IDs are logged.

Validation: 137 mobile tests across 39 files; TypeScript passes; lint has zero errors and five existing warnings. iOS Hermes export: 2006 modules, 6.2 MB. New fault/concurrency tests verify durability-before-feedback, no wait on hanging maintenance/network jobs, current-cache rebasing, account-switch isolation, sharing in-flight sync, failed-job retry and old-job cleanup isolation.

Device attempts: first encountered native “Cannot find native module ExpoAsset”; the member reopened Expo Go and reported that the interface appeared. The subsequent measurement attempt disconnected before any trace/screenshots were captured. A later attempt found no connected iPhone. No new device timing, FPS improvement, before/after latency percentage or human acceptance is claimed for these changes.

No backend source changes, migrations, database changes or new staging deployment are needed for this follow-up. The previous dedicated staging API remains deployed. Review remains required; no merge.
