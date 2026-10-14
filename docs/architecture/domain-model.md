# Domain model

The pure model lives in `packages/domain`. The tables live in `database/migrations/0001_core.sql`. Names match closely; the database has not been migrated.

## Identity

`validateOnboarding` accepts age, height in centimeters as a decimal string, weight in kilograms as a decimal string, goals, discipline, equipment, diet, allergies, supplements, injuries, and locale. It stores height as millimeters and weight as grams. `authoritativeCalorieTarget` is always null. Risk flags route minors, reported injuries, extreme BMI hundredths, and self-reported calorie targets to review.

`authorize` enforces member ownership, support non-health reads, gym tenant isolation, finance settlement, and separation of rule authorship from approval.

## Training

A session is scheduled only with explicit exercises. Commands are start, pause, resume, log set, complete, and abandon. Completion requires at least one logged set. Personal records are derived only from completed sessions. Offline logs do not overwrite a completed or abandoned server session.

Prescription kinds are strength, CrossFit formats, and calisthenics progressions, and they must match the discipline.

## Nutrition

Diary totals sum integer kilocalories and milligrams. Image estimates are included and also reported separately. Remaining macros exist only when an approved target is supplied. No approved formula is shipped.

Atwater factors (4, 4, 9 kcal per gram) are an arithmetic check, not a meal plan.

## Coaching

Rules have status, priority, effective window, conditions, actions, and safety blocks. Production mode uses the newest approved effective version of each rule. A safety hit stops lower-priority rules. Simulation cannot be stored as a plan. Authors cannot approve their own rules.

## Commerce

Subscription status changes only from verified events. Duplicate event ids do not apply. Older non-corrective events are ignored. Refunds and revocations still apply. Entitlement during billing retry or cancellation requires the period end.

## Partnerships

The first attribution for a user is locked. Later codes do not replace it. A purchase is attributable only inside the contract window. Commission math is described in `commission-ledger.md`.
