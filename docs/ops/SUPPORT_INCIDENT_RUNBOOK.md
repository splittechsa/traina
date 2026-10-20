# Traina — Support & incident runbook

**Status:** Operational draft (not a substitute for on-call tooling contracts)  
**Updated:** 2026-10-18

## Channels

| Channel | Use |
| --- | --- |
| `support@traina.app` | Member operational questions (no sensitive health dumps over plain email) |
| In-app Help | FAQ + account deletion path |
| Coach Workspace | Human-coach queue / escalations |

## Severity

| SEV | Meaning | First action |
| --- | --- | --- |
| SEV-1 | Auth/data-loss / unsafe recommendation apply | Freeze risky writes; page eng; check `/v1/ready` + DB |
| SEV-2 | Coach inbox / Yazan outage for paying members | Check provider env + `ai_usage`; fall back to in-app honesty |
| SEV-3 | Single-member bugs / UX | Reproduce in staging; open ticket |

## Monitoring checks

1. `GET /v1/health` — process alive  
2. `GET /v1/ready` — DB + production auth; currently also reports `store_verifier` missing (expected until billing)  
3. Coach workload metrics — `/v1/coach/workspace/metrics`  
4. Do **not** invent burn rates or fake SLOs without measured baselines

## Hard non-actions

- Do not enable fake IAP / store checkout to “unblock” support  
- Do not apply nutrition adaptations while ENERGY_POLICY is blocked  
- Do not claim PDPL completion while P0-PRIV counsel is open  
- Do not send remote push until APNs/FCM delivery is configured (`deliveryConfigured: false`)

## Account privacy ops

- Export: `GET /v1/account/export` (facts only; legal packaging pending counsel)  
- Delete: `DELETE /v1/account`  
- Coach-share consent: grant/withdraw via `/v1/member/coach-share-consent`
