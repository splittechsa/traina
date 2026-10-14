# ADR 0014 — First-party email sessions until an identity provider exists

## Status

Accepted. Extends ADR 0011. Does not replace it.

## Decision

No identity-provider credentials are available. Member registration uses scrypt password hashes in `user_credentials`. Verification and reset tokens are stored as SHA-256. Access tokens are short-lived HMAC tokens that carry a session id. Refresh tokens are random, stored only as hashes, and rotated. Roles are loaded from `role_assignments` on each request.

The development mailbox writes plaintext tokens to `email_outbox`. That mailbox is refused when `NODE_ENV=production`. HMAC development tokens remain refused in production.

Sign in with Apple is not implemented.

## Consequences

`auth.production_idp` stays unimplemented. Session auth is an application boundary, not a claim that email delivery, device management, or account recovery work in production.
