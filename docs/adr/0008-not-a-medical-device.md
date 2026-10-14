# ADR 0008 — General fitness product, not a medical device

## Status

Accepted.

## Decision

Sahhti records self-reported training and nutrition data and applies approved fitness rules. It does not diagnose, prescribe treatment, or present user stories as evidence.

Ages under 13 are rejected. Ages 13 through 17, reported injuries, and extreme body-mass values are flagged for review. Those thresholds are operational routing rules, not a clinical protocol, and they need a later policy review.

## Consequences

No diagnosis tool will be added to the coach. High-risk profiles do not receive an automated plan.
