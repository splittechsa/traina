# Deployment runbook — 2026-10-20

Release state: NO-GO. These steps describe the controlled promotion procedure; production deployment has not been executed.

1. Authenticate GitHub and fetch current master/PR status. Review the mixed working tree against the pre-existing changes. Obtain required independent security review before merge.
2. From the repository root, run npm run build and node scripts/verify-launch.mjs. On this Windows sandbox, TEMP and TMP must point at a writable task directory. Review every exit code and docs/evidence/launch-2026-10-20/validation-summary.json.
3. Provision an isolated staging database with synthetic data. Never seed the configured production branch with seedDevelopment. Supply the existing API driver with staging DATABASE_URL and direct DATABASE_URL_UNPOOLED. Keep secrets server-side.
4. Compare schema_migrations with database/migrations. Test 0031_program_member_customize.sql in staging, including existing program_versions source constraints and concurrent program edits on actual PostgreSQL. The production inspection only found 0001–0030.
5. Start the compiled API with session auth, a non-development token secret, the approved provider and a production-like environment. Confirm /v1/health and /v1/ready, negative auth, IDOR, onboarding and coaching approval gates.
6. Deploy the coach portal built by npm run build from apps/coach-portal. Validate the configured API origin and role/assignment/consent boundaries with synthetic accounts.
7. Replace the placeholder staging URL in apps/mobile/eas.json only after a working HTTPS staging service exists. Confirm Expo project/account ownership and signing. Build internal preview artifacts, install on physical iPhone and Android, and execute EAS_DEVICE_QA.md and PR49_DEVICE_ACCEPTANCE.md.
8. Verify notification delivery, payment sandbox lifecycle, exports, closure/erasure policy, support operations, monitoring and restore evidence. Keep live payments off, unapproved nutrition adaptations blocked and draft website unpublished until release gates clear.
9. Capture exact commit, image/build identifiers, migration inventory, checks, reviewers and rollback target. Promotion requires a revised evidence-backed GO decision and any explicitly required release authorization.

There is no verified production host/pipeline identifier in this pass. Do not invent one or treat a local build as a deployed release.
