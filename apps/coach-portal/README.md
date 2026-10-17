# Traina Coach Workspace

Operational web dashboard for assigned human coaches.

## Run

1. Start the API (`npm run dev:api` from repo root).
2. `cd apps/coach-portal && npm install && npm run dev`
3. Sign in with a user that has `coach_reviewer` (and an admin-created assignment).

Members must grant `/v1/member/coach-share-consent` before coaches can read packets.

Assignments are **admin / coach_supervisor only** — this UI does not offer self-assignment.
