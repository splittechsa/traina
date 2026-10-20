# Traina physical iPhone experience evidence — 2026-10-21

Status: PARTIAL; release NO-GO. Actual Expo Go iPhone screenshots and bounded JS traces are available. No release-mode acceptance or independent human usability acceptance is implied.

## Scope and method

Baseline: instrumented 7971d04 before product changes. Experienced synthetic account seeded with 100 completed workouts and 300 historical sets. Same physical iPhone, Expo Go development runtime, public isolated staging API. Journey: Today → Training → scheduled workout → start → enter 8 reps / 20 kg three times → rest → warm Training. Final experienced and beginner runs additionally verify exactly three matching persisted sets over public HTTPS. Credentials are external encrypted DPAPI fixtures; no customer records were used. Prior session and API override are restored by the driver.

The original device was using a LAN API override. The harness temporarily selects the isolated staging endpoint and restores the LAN override afterward. Device auth is verified before test entry.

Single-pass observational comparison, not a controlled benchmark: network latency, Metro/Fast Refresh, navigation replacement, additional synthetic scheduled workouts and warm caches differ. No statistical confidence or native FPS claim. Intermediate hot-refresh attempts with stale diagnostic bindings are excluded; use only baseline, verified-experienced, verified-beginner folders. Baseline saved-set UI is visible in screenshot 05; final runs add server assertions.

## Observations

| Measurement | Baseline | Final experienced |
| --- | ---: | ---: |
| SQLite open + schema calls during measured journey | 41 | 1 |
| Aggregate SQLite initialization wall time | 610.2 ms | 11.8 ms |
| React commit duration p95 | 98.4 ms | 46.8 ms |
| React commit duration maximum | 171.9 ms | 78.7 ms |
| Screen render events | 65 | 40 |
| JS 100 ms timer excess delay p95 | 36.7 ms | 12.2 ms |
| JS timer excess delay maximum | 328.3 ms | 140.0 ms |
| API requests | 16 | 21 |
| API observed duration p95 | 713.9 ms | 828.0 ms |

API measurements end at the client request lifecycle and do not isolate database/transport/render time. Network performance regressed in this pass; do not claim backend acceleration. React durations are development profiler observations. Hermes CPU Profiler commands are unsupported on this target; no CPU profile was fabricated. Native UI FPS, process memory, cold launch, crash-free rate, release builds, Android and screen recordings: NOT_MEASURED / NOT_TESTED.

## Root causes and implemented changes

1. SQLite adapter opened the database and executed both CREATE TABLE statements for every serialized read/write. Trace confirms 41 initializations. Reuse one initialization promise; reset on initialization failure and close a failed connection. Preserve owner scoping, durable writes, exclusive transactions and acknowledgment ordering. Recovery fault test plus existing SQLite rollback/replay/account isolation tests pass.
2. Training eagerly rendered the entire 100-session history in a ScrollView. Render 12 rows and expose more in batches, preserving all sessions and active-workout discovery. Backend still returns the full history; server pagination and fully virtualized history remain open.
3. Training blocked on the exercise catalogue even when session data was ready. Gate the main page on sessions, fetch manufacturer registry only when the builder opens, skip closed-builder filtering. Existing builder subtree was already conditional; it was not an unconditional catalogue-render root cause.
4. Rest tick updated the entire workout screen every second. Isolate ticking to RestCountdown; use absolute persisted anchors so background and pause/resume retain correct remaining time.
5. Native screenshots showed Yazan and session totals above the current exercise, burying inputs. Keep full coaching/context cards for overview/completion, bring reps/load ahead of set history, show a contextual Yazan action, keep the primary action pinned, and advance to the next exercise after prescribed strength sets.
6. Workout route imported THREE/GL instruction rendering even before activation. Remove unreviewed procedural demonstration from this flow. No licensed, technically approved realistic muscular trainer is available in the evidence package. This required product gate remains BLOCKED, not completed by a placeholder.

## Information architecture and component rules

Primary destinations: Today (next action), Training (resume/plan/library), Nutrition (daily logging), Progress (actual trends), Yazan (contextual guidance). Existing secondary routes remain accessible. Home/coach tabs now display Today/Yazan. Account/settings, program create/edit/manage, exercises, meal builder/scanner/macros, activity/weight/supplements, weekly check-in, help/membership, gyms/community/notifications, auth/onboarding retain their routes. Route inventory is in route-inventory.txt.

Workout overview: actual exercise/set counts, ordered prescriptions, explicit start guidance and start action. Active workout: current exercise position and prescription, editable reps/load, actual logged rows, persisted rest with pause/resume/skip, next exercise CTA, optional contextual Yazan. Completion: saved set count, distinct actually logged exercises, recorded volume and pause-adjusted elapsed time using existing domain arithmetic. No invented points, PRs or achievement claims.

Reuse existing theme tokens, SurfaceCard, Button, AppHeader and locale copy. Minimum existing input/button touch heights retained. Native Arabic screenshot evidence exists. English restart/direction, VoiceOver, large type, one-handed human acceptance and Android remain open. No complete design-system overhaul is claimed.

## Validation and remaining acceptance

125 mobile tests pass (36 files), including a new storage initialization failure/recovery test; typecheck passes; lint has zero errors and five pre-existing warnings. iOS production Hermes export is recorded separately in validation.json. Scripted native handlers are not physical touch automation or an independent human usability study. Completion evidence attempt timed out at the device runtime; neither the completion screen nor the confirmation dialog is verified in this session. Yazan response quality, next-day return, full offline native airplane-mode recovery and licensed animation approval remain open. No customer deployment, production database mutation, billing activation or merge occurred.

Proposed acceptance budgets, not measured achievements: release-like warm navigation p95 <300 ms; native interactive frames at device refresh rate without >100 ms main-thread stalls; local durable set acknowledgment p95 <150 ms; full cold launch p95 <2.5 s on named supported devices; measure process memory and extended workout stability. Collect repeated release-mode traces before accepting any budget.
