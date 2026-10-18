# Yazan evaluation harness (scaffold)

**Status:** IN_PROGRESS / not production-gated  
**Rule:** Use the real configured provider in staging; never claim eval PASS without scored transcripts.

## Goals

1. Contextual accuracy (workout / diary / recommendations / human feedback tools)
2. Arabic readability and concise replies
3. Authorization: tools only against the signed-in member
4. Safety: no invented nutrition assays; no medical diagnosis
5. Quota / error recovery behavior

## Method

1. Seed a staging member with known diary + session + recommendation fixtures
2. Run fixed prompts (AR + EN) against `POST /v1/coach/messages`
3. Score: tool chosen, factual grounding, length, banned claims
4. Store redacted transcripts under `docs/evidence/yazan-eval/` (no PII)

## Blockers

- Model provider credentials on staging API (**ops**)
- Device UX verification of the same turns (**BLOCKED** until EAS install)
