# Security threat model

This is a design threat model for the current code. It is not a penetration test.

| Threat | Property | Control in this increment | Gap |
| --- | --- | --- | --- |
| Caller sets another user's id on a coach tool | Authorization | Call rejected | No live model to abuse it yet |
| Caller sends SQL in tool arguments | Injection | Call rejected; no SQL tool | Database role grants are not applied |
| Client names its own commission | Integrity | Strict schema rejects the field; server calculates | Quote priors are still caller-supplied and labeled as such |
| Client callback marks a purchase paid | Integrity | Unverified subscription events throw; verify route returns 501 | Store webhooks are not built |
| Gym A reads gym B | Isolation | `authorize` returns `TENANT_ISOLATION` | Not enforced inside PostgreSQL policies yet |
| Support reads health data | Confidentiality | Support profile scope is `non_health` | The field filter is not a query yet |
| Author approves their own rule | Integrity | `SELF_APPROVAL` | No editor UI |
| Ledger edit | Integrity | Trigger rejects update and delete | Migration not applied, so the trigger is unproven on a server |
| Open API in production | Authentication | Default mode returns 503 | Real OIDC is not integrated |
| Dev HMAC token in production | Authentication | Process throws if `NODE_ENV=production` | Secret management is not deployed |
| Prompt injection | Authorization | Tool boundary, not a keyword filter | No model evaluation suite against a provider |
| Malicious upload | Availability | No upload endpoint | Future media needs type checks and scanning |

Secrets do not belong in mobile apps. `.env.example` has no live credentials. Card numbers are out of scope for storage.

Rate limiting exists for coach tool quotas in memory. It is not a distributed limiter.
