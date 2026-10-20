# Traina staging handoff — 2026-10-20

Commercial release recommendation: **NO-GO**. Staging deployment is verified; this is not production launch approval.

## Actual deployments

- API: https://traina-staging-api.vercel.app
- Website: https://traina-staging-www.vercel.app
- API deployment: dpl_BoaNkrgjHFkhQGWvsr2sjsUZg8ks (Vercel team splittech1).
- Website deployment: dpl_CJeM32UXgdnC6JXRtfw4TGfKJwEp.
- Isolated Neon project: solitary-pond-59179148, database traina_staging, PostgreSQL 18. All 33 migrations applied to a new empty database; only synthetic catalog/account data used. Production fragrant-fog-72018396 was not modified.

## Compatibility audit and deployed behavior

Fastify runs through an explicit Node request adapter in services/api/src/vercel.ts. It creates a request-scoped database pool (maximum two connections), waits for response completion, then closes the app and pool. The function limit is 60 seconds. Migrations and seeds run separately under an owner role; runtime credentials cannot modify migration history or create schema objects. The monorepo builds contracts/domain before API. A source-only deployment manifest excludes credentials, environments, local databases and mobile artifacts.

Authentication throttles use shared PostgreSQL counters rather than process memory. Human-coach queues remain database-backed and require operator processing; no continuous worker is claimed. Gemini has a bounded 28-second provider budget. The current SSE endpoint buffers the model response before emitting it; it is not incremental token streaming. Public HTTPS exercised response completion and connection cleanup. This workload fits the tested Vercel adapter; a future continuous worker should use persistent hosting without forcing an API rewrite.

## Evidence

Local verification: 326 tests passed (136 domain, 3 contracts, 1 tokens, 68 API, 118 mobile), builds/typechecks, mobile lint (five existing warnings), coach build and loopback HTTP acceptance smoke. See ../evidence/wave-b-2026-10-20/validation-summary.json and adjacent logs.

Public HTTPS: 56 calls, PASS_WITH_REVIEW, in ../evidence/staging-2026-10-20/public-https-smoke.json. Auth verification/login/refresh/logout, member ownership, custom workouts, concurrent replay, stale-edit rejection, program history/restore/copy/archive, synthetic human-coach assignment/consent/revocation, real Gemini and buffered SSE were exercised. Gemini text still needs qualified review. An initial fixture-role failure is retained separately; final run corrected the synthetic role. Website home/English/privacy/terms return 200 and noindex headers.

/v1/health returns 200. /v1/ready deliberately returns 503 because store_verifier is absent. Purchases remain disabled. No live payment or email provider was configured. Synthetic outbox verification is not delivery-provider acceptance.

## Required environment variables

Server only: DATABASE_URL (pooled traina_staging_app role), SAHHTI_TOKEN_SECRET (fresh staging secret), SAHHTI_AUTH_MODE=session, SAHHTI_ENVIRONMENT=staging, SAHHTI_COACH_PROVIDER, SAHHTI_COACH_API_KEY, SAHHTI_COACH_BASE_URL, SAHHTI_COACH_MODEL. Values are stored as sensitive Vercel environment settings. The owner connection is operator-only and must never be added to mobile or Vercel runtime settings. Existing authorized Gemini credentials are reused; no key values belong in this report.

Mobile public configuration: EXPO_PUBLIC_API_URL=https://traina-staging-api.vercel.app in both development and preview profiles. Production profile was not redirected. Runtime version is explicitly 0.1.0-staging.1; increment it for native compatibility changes before publishing updates. No OTA update was published.

## Reproduction

From the repository root: npm ci; npm run build. Apply reviewed database/migrations files only after explicitly selecting the isolated staging database and verifying its project/database identity; never use an implicit production connection. scripts/staging-https-smoke.mjs requires TRAINA_STAGING_OWNER_URL and TRAINA_STAGING_PROJECT_ID=solitary-pond-59179148; the owner secret must come from secure operator storage and never shell history. It creates disposable synthetic fixtures and accesses the staging outbox privately.

Use scripts/prepare-staging-source.mjs api <new-dedicated-directory> to create the source-only bundle, inspect source-manifest.json, link to splittech1/traina-staging-api and deploy with Vercel CLI using vercel.api.json. Deploy apps/www independently to splittech1/traina-staging-www. CLI authentication and encrypted operator configuration remain local and are excluded from delivery.

From apps/mobile: npx eas-cli@latest build --platform android --profile preview; npx eas-cli@latest build --platform ios --profile preview. This sandbox required EAS_NO_VCS=1 and EAS_PROJECT_ROOT pointing to the repository to avoid its blocked temporary Git clone; inspect .easignore before using this mode. Android native sources are present and included; build caches and keystores are excluded. The eas-build-post-install hook builds the shared domain package.

## Remaining release gates

Independent security/code review and PR integration are absent. PRs 46–48 are not ancestors of this stack; a dry merge of 48 reported conflicts in account UI, translation copy, product routes/tests and completion matrix. No PR was merged. Physical Android/iPhone acceptance, background/kill/relaunch/account-switch evidence, professional AI/scientific review, human staffing/operations, payment/store verifier and production operational acceptance remain open. Do not infer completion of all 447 requirements from targeted tests.

Android build: https://expo.dev/accounts/splittech/projects/sahhti/builds/57cea473-8e52-4183-bf15-20bd5d3f13f9 (queued at last check). iOS internal build is blocked: no suitable distribution credentials; an account owner must complete interactive Apple signing setup. No installable artifact or physical acceptance is claimed yet.
