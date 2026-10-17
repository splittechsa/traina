# AI coaching architecture (Traina / Yazan)

## Product spine

Traina’s product is **Yazan (يزن)** — a science-based AI coach that feels like a real online coach.

Daily logging (water, food, sessions, supplements, weight, measurements) is **input infrastructure**. The coach reads those facts every day; the features are not the destination experience.

```text
athlete logs (free infrastructure)
  -> trusted server snapshot
  -> Yazan daily check-in (deterministic brief ± model polish)
  -> chat with Yazan (model + tools; writes need confirm)
  -> weekly survey + auto packet
  -> queued file for a human coach
```

## Science rules

- Never invent burned kcal, labs, sodium claims, or undeclared food macros.
- Absent values stay unknown.
- Plan changes are proposals — confirm before apply (no silent edits).
- Extreme dieting / disease diagnosis / unprescribed supplements are blocked in the system prompt.

## Implemented

- Tool list, argument rejection, quota, snapshot-trusted tool execution.
- Conversation persistence (`coach_conversations` / `coach_messages`).
- OpenAI-compatible + development_mock providers; system persona = Yazan / Traina.
- Enriched snapshot: water, supplements, nutrition phase/pace, 14-day logging discipline.
- `POST /v1/coach/daily-checkin` — one proactive message per day from logged facts.
- `POST /v1/coach/weekly-brief` — athlete survey + facts → `coach_weekly_briefs` queued for human.
- Domain: `packages/domain/src/yazan-coach.ts`.

## Not implemented yet

- Human coach inbox UI / assignment workflow.
- Push notifications for daily check-in.
- Model auto-apply of nutrition/program proposals.
- Evaluation harness against a live model in CI.
