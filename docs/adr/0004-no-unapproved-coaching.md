# ADR 0004 — No coaching canon is shipped as approved

## Status

Accepted.

## Decision

The founder will supply professional rules. This repository does not invent cutting, bulking, or calorie formulas and mark them approved.

`authoritativeTargetFromFormula` returns null unless a formula is approved, and an approved id still has no executor until that formula is implemented on purpose. Self-reported calorie targets are stored only as reports and always raise `self_reported_calorie_target_ignored`.

Production rule evaluation ignores drafts. Simulation results cannot be persisted as a user plan.

## Consequences

The product will not generate a training plan or a calorie target until a reviewer approves a versioned rule. That is intentional.
