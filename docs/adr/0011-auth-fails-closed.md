# ADR 0011 — Authentication fails closed

## Status

Accepted and tested.

## Decision

The default API auth mode is `unconfigured`. Member routes then return 503 `AUTH_NOT_CONFIGURED`.

`hmac_dev` signs test tokens with HMAC-SHA256 and refuses to start when `NODE_ENV=production`. It is not an identity provider. Production auth will be an external OIDC provider. The database will store session token hashes, not raw tokens, and it will not store passwords for that provider.

## Consequences

A misconfigured deploy does not fall back to open access or to a shared demo user.
