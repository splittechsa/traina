# Current staging handoff — 2026-10-23

**Public launch remains NO-GO.** The isolated staging API, website and admin workspace are deployed. Earlier preparation steps below are historical; they do not describe the current staging state.

- API: https://traina-staging-api.vercel.app; website: https://traina-staging-www.vercel.app; admin: https://traina-staging-admin.vercel.app. Use synthetic accounts only. Health and HTTP availability are separate from commercial readiness: `/v1/ready` reports missing `store_verifier`; live payments stay disabled.
- Isolated Neon project `solitary-pond-59179148`, database `traina_staging`, has verified migrations 0001–0035. The production project was not migrated or seeded during this closure.
- Mobile `development` and `preview` profiles use the actual staging HTTPS origin. `preview` produces signed Android APKs; `preview-emulator` is an x86_64-only release APK for the PC emulator. Neither is a production store release. Persisted development endpoint overrides are ignored in release builds.
- SDK57-compatible patches and splash plugin configuration require runtime `0.1.0-staging.2`. Build from `apps/mobile` with `eas build --platform android --profile preview`. For this PC use `--profile preview-emulator`. Install the downloaded APK with Android SDK `adb install -r <APK>`, then launch `sa.sahhti.member/.MainActivity`. Expo Go/Metro is unnecessary for the signed APK.
- Build and environment provenance, native screenshots, recordings and remaining limitations are in [the closure report](../evidence/android-closure-2026-10-22/REPORT.md). An archive inspection must reject secrets, credentials, local databases, generated native projects and working folders before upload. Do not commit `.env` or signing files.
- Server-only API variables: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SAHHTI_TOKEN_SECRET` (at least32 characters), and `SAHHTI_COACH_PROVIDER`, `SAHHTI_COACH_API_KEY`, `SAHHTI_COACH_BASE_URL`, `SAHHTI_COACH_MODEL`. Retain the verified staging values in the hosting secret store. Website uses `TRAINA_API_ORIGIN` and `WEBSITE_ORIGIN`; admin uses `TRAINA_API_ORIGIN` and `ADMIN_ORIGIN`. Only `EXPO_PUBLIC_API_URL` belongs in the mobile bundle. See the existing service configuration for the complete environment schema; this list is not permission to reuse staging secrets in production.
- Before promotion: close dependency-security findings, obtain independent PR57→PR58 approvals/current-head CI, record a signed physical iPhone journey, qualify Android performance on actual hardware, approve coaching/AI and licensed exercise demonstrations, and complete privacy/store/payment/operations gates. Apple Developer access and reviewed demonstration assets are currently unavailable. Do not merge or submit based on emulator checks alone.

# Historical deployment plan — 2026-10-20

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
