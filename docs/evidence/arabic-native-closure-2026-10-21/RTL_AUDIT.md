# Arabic UX closure — source review and device evidence status

Date: 2026-10-21. **PARTIAL; not a completed visual audit or device acceptance.**

The user reported the application would not open, then confirmed the interface opened but displayed a failed-request message during opening/navigation. No inspector target was connected on either Metro8081 or8082 when checked. Therefore no fresh before/after screenshot, recording, native render/input latency or memory measurement was captured. Earlier screenshots are not substituted for this run. Product Design screenshot audit is blocked; the table below is a source review and runtime checklist.

## Layout strategy

Screen remains the single layout-direction root. Rows use plain row, never row-reverse plus RTL. Shared locale Text defaults to the Arabic right edge with IBM Plex Sans Arabic and Unicode mixed-script direction; explicit centered/numeric styles override it. This does not reverse content strings. Modal sheets establish their own direction boundary. SettingsRow explicitly establishes direction, logical leading icon, aligned label/value and locale-specific chevrons on iOS/Android/web. Email/password/numeric Field contents use LTR input semantics. Locale hydration restores saved English and does not unconditionally force Arabic in the entry point; reverting a pending language switch cancels the restart notice.

| Step | Surface / route | Source finding and implemented refinement | Running visual health |
| --- | --- | --- | --- |
| 1 | Home /(tabs)/home | Shared locale typography/alignment; server read no longer waits for optional SQLite snapshot writes | BLOCKED: no fresh screenshot |
| 2 | Profile /account, /profile-edit | Profile becomes logical leading avatar + start-aligned flexible information; explicit back control; shared text | BLOCKED |
| 3 | Settings /settings | Explicit back control, directional row boundaries, label/value alignment, platform chevrons, persisted-language fixes | BLOCKED |
| 4 | Membership /membership | Shared typography/mixed-script alignment; existing entitlements retained | BLOCKED |
| 5 | Training /(tabs)/training | Shared text with existing bounded server pagination and filters | BLOCKED |
| 6 | Workout /workout/[id] | Compact labeled reps/load inputs; inline completed-set editing; save remains accessible after final set; rest +15s preserves pause; named exercise navigation | BLOCKED: actual finish-confirmation scenario not repeated |
| 7 | Program selection/editing /programs,/program-manage,/program-edit | Shared text; existing authenticated versioned editor and substitution bottom sheet retained | BLOCKED; active-session substitution is not added |
| 8 | Nutrition /(tabs)/nutrition,/food-log,/meal-builder | Tappable meal-section headers; quantity tap/hold/accessible activation; accessible direct amount editing; shared text | BLOCKED |
| 9 | Progress /(tabs)/progress,/progress,/weight,/activity | Shared typography and physical units alignment; chart geometry retained | BLOCKED |
| 10 | Yazan /(tabs)/coach | Shared text; existing user/assistant bubble semantics retained | BLOCKED |
| 11 | Human-coach feedback /(tabs)/coach | Shared text; authorization/workflow unchanged | BLOCKED |
| 12 | Weekly check-in /weekly-checkin | Shared text and existing draft recovery | BLOCKED |
| 13 | Notifications /notifications | Shared text; live backend routes unchanged | BLOCKED |
| 14 | Remaining customer routes /exercises,/help,/gyms,/supplements,/macros,/scanner,auth/onboarding | Shared text where direct Text was used; shared primitives cover auth; existing keyboard/safe-area primitives retained | BLOCKED |

## Interaction and reliability fixes

- Final-set edit previously lost its Save action to Next/Finish. A regression test now requires Save while editing the final logged set. Existing durable queue/replay logic remains in use.
- New set entry and inline editing use the same compact control. Completing a set still requires one action; local durability remains mandatory before success feedback.
- Rest adjustment preserves paused state and persists through the existing timer snapshot path. No full-screen per-second animation added.
- Quantity buttons now handle ordinary accessibility activation; holding still repeats and stops on release. Direct editing is an accessibility action. Haptic failures are nonfatal.
- Optional successful-read snapshot writes no longer block navigation or turn a server-confirmed successful read into an error. Critical workout queue writes are not relaxed. Resource snapshot persistence is eventual; an immediate force-close may lose the latest read cache, not the acknowledged workout mutation.

## Startup/navigation failure investigation

The local mobile .env pointed to http://192.168.8.39:3040 rather than the dedicated public staging API. The local file was corrected without committing it. The served iOS bundle was checked: staging URL present, old LAN API URL absent. The retired/other local API still returned health200; its account data was not migrated or deleted. Thus the endpoint mismatch is a verified configuration finding, not proof of the entire reported failure's cause.

Public staging synthetic login, home, profile, progress, history, programs and entitlements returned200 in one concurrent probe (573–1489ms). These are host measurements, not phone navigation/input latency. A separate code path could wait for a read-cache write after a successful API response; two tests now cover stalled/failed optional caching. The phone's error status/code was not captured, and physical resolution remains unverified.

Use npm run start:staging in apps/mobile to explicitly supply the staging URL instead of inheriting a retired LAN value. SecureStore diagnostics overrides remain supported and must be checked if an old endpoint persists. The ngrok tunnel failed after restart; LAN Metro8082 serves a successfully compiled bundle at exp://192.168.8.39:8082 on the same Wi-Fi. This is a development server, not a hosted release.

## Regression scope

Component tests verify Arabic/mixed-content alignment and explicit center overrides, saved-language hydration/reversion/races, final-set editing, timer adjustment and quantity accessible/hold input. They are not screenshot regression tests. Native screenshot baselines must be established on actual devices at identical route/state/viewport, with Arabic, English, mixed names, large text, keyboard, VoiceOver/TalkBack and restart. No screenshot pass is asserted.

Independent approval is still missing. Review PR57 first, then current PR58 CI/diff. Do not merge or declare full Arabic/native acceptance until running-device evidence exists.
