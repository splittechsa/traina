# Traina admin workspace

Arabic RTL administrative workspace, served independently from the member app and public website. Live staging: https://traina-staging-admin.vercel.app.

The static UI calls a same-origin Node serverless gateway. Credentials are exchanged with the shared API; access/refresh tokens are held in Secure, HttpOnly, SameSite=Strict host-only cookies. Browser code never stores tokens in localStorage. Mutations require the configured exact Origin. Routes and methods are allowlisted. Every API admin operation checks the persisted current administrator role, including after revocation.

Features: actual operating metrics and workout trend; bounded member search; coach assignments/revocation and review queue; website interests with conflict-safe status changes; support status workflow; append-only audit feed. No invented revenue or client-side permission grants. No billing, scientific-rule publication or member suspension controls are exposed by this interface.

Environment: TRAINA_API_ORIGIN (default verified staging API), ADMIN_ORIGIN (default this staging hostname). Change both explicitly when deploying elsewhere. Deploy this directory as a separate Vercel project; framework=null and no frontend dependency install is required. Tests: node --test apps/admin-web/gateway.test.mjs from repository root. Backend integration: npm run test -w @sahhti/api -- src/admin.integration.test.ts.

Migration 0034_website_interests.sql must be applied separately before use; grant the restricted runtime role SELECT/INSERT/UPDATE on that table. Never deploy owner DB credentials to this gateway. Synthetic preview administrator credentials are Windows-DPAPI-encrypted outside the repository; no default password is shipped.

The browser capture provider is unavailable on this host, so a visual browser/native audit is still pending. Public HTTPS functional verification is recorded in docs/evidence/admin-web-2026-10-20.
