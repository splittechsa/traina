# Release strategy

## Now

GitHub Actions runs tests and typecheck on push and pull request. It does not deploy. There is no staging environment.

## Before a mobile beta

- Production OIDC, applied migrations, and a restore drill.
- Server-side StoreKit and Play verification.
- Account deletion.
- Privacy disclosures and an age policy reviewed by counsel.
- TestFlight and Play internal testing.
- No claim of store approval until the store says so.

## Before calling production ready

The acceptance list in the product brief: permissions, durable workouts, nutrition arithmetic, rule enforcement, verified purchases, idempotent money, tenant isolation in the database, audited admin actions, mobile tests, restore evidence, and load evidence against the capacity sheet.

This repository does not meet that list.

## Rollback

API rollback is a previous container image once images exist. Schema rollback is a forward migration, not an edit of `0001_core.sql` after it has been applied. Ledger rows are not deleted to undo a mistake; a reversing entry is posted.
