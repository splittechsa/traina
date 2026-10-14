# AI memory design

Memory is structured state, not the chat transcript.

| Layer | Source of truth | Status |
| --- | --- | --- |
| Profile | `user_profiles` and onboarding snapshots | Schema written; validation does not persist |
| Goals | `user_goals` | Schema written |
| Training | programs, sessions, sets | Session reducer tested; tables not applied |
| Nutrition | targets and food entries | Arithmetic tested; no food catalog seeded |
| Progress | measurements and personal records | Records derived in memory from completed sessions |
| Preference | confirmed choices | Not a separate store yet |
| Conversation | messages plus a user-confirmed summary | Tables exist in SQL; `saveConfirmedMemory` does not persist |

A summary becomes durable only when the member confirms it and a repository insert succeeds. The coach cannot promote a chat line into a profile, a calorie target, or a commission.

Retrieval for a tool uses the authenticated user only. Support reads of profiles are scoped `non_health` and require an audit flag. That flag is returned by `authorize`; an audit row is not written until the database is connected.
