# Android workout closure evidence — 2026-10-22

Release remains **NO-GO**. This is actual interaction on Android API 36 / Pixel 7 emulator, Expo Go 57.0.9, against the isolated public staging API. It is not a physical iPhone, signed preview binary, independent human usability study, or native performance acceptance.

## Observed and reconciled

- Host WHPX acceleration probe returned 0/usable; Android boot completed, ADB connected, matching Expo Go installed. Metro 8085 and ADB reverse opened the real app. Earlier pending-Windows-restart status is superseded.
- Signed in using the existing synthetic beginner fixture. No customer account or production database was used.
- Logged three bench sets from native controls; edited the final set from 8 to 9 repetitions at 20 kg. Server reconciliation confirms the edit, six total sets, and a recorded pause/resume interval.
- Disabled emulator Wi-Fi and data, then tapped three additional sets in a 1,259.9 ms dispatch window (includes intentional 350 ms waits and ADB overhead). Server remained at six sets during disconnection. Foregrounding after reconnect synchronized exactly nine sets. This is an input sequence observation, **not** measured input latency or FPS.
- Native completion confirmation sent the request through a local fault-injection proxy. Upstream returned 200; proxy destroyed the first successful response. The actual app reconciled with a GET that returned `completed` approximately 455 ms later. The summary appeared without a generic request-failure message.
- Replayed completion through HTTPS: completion timestamp and nine sets unchanged; no duplicate set IDs; completed session present in history.
- Force-stopped and relaunched Expo Go with the public staging endpoint restored. Summary and saved-session confirmation remained visible without a generic error.
- Opened home, training, nutrition, progress, Yazan, account and settings using native deep links and captured their visible screens. This does not establish every action on those routes. A blocking restart alert on settings was discovered and replaced with a nonblocking notice.
- English selection survived a real process restart; Arabic was restored. Expo Go still reports a native direction mismatch in Arabic, so full signed-binary RTL acceptance remains open.

## UX changes prompted by screenshots

Physical text alignment now stays stable inside RTL layout containers while Unicode still controls Arabic/Latin runs. Exercise progress uses “set X of Y”; completed exercises hide unused entry fields while remaining editable. Pause is available in the active header. Rest controls occupy less space. Completion summary and record comparisons precede the exercise list; completed exercise counts use actually logged exercises and volume includes units. Long session durations show hours. Auth links follow locale alignment. Keyboard insets handle Android overlay and resize behavior without double padding; four regression cases cover overlay, resize, hide, initial visibility and preserved iOS behavior. Fresh keyboard visual acceptance remains partial because Gboard stylus onboarding interfered with automation.

## Validation and limitations

160 mobile tests / 45 files, mobile typecheck and lint (zero errors, five existing warnings). Domain 136, contracts 3, design tokens 1, API 81 and admin 8 tests passed: 389 total. Root typecheck/build passed. Optimized Android/iOS Hermes exports passed during this session; exports are not signed installable binaries. See `validation.json` for final build status.

Screen recordings with Android `screenrecord --bugreport` timestamps and the complete image set are in the delivered local evidence package; `artifact-manifest.json` records hashes. No tokens, passwords, raw request bodies, customer records or private fixture files are included. The synthetic workout started in an earlier test session, so its long elapsed duration is real fixture history, not startup or completion latency.

The public website and admin returned 200. API health returned 200; commercial readiness intentionally returned 503 with `store_verifier` missing. Payments remain disabled. Production data was not deployed or migrated.

## Remaining launch gates

Signed Android preview installation/performance; physical iPhone signed-build journey and recordings (Apple Developer access unavailable); native startup/FPS/memory and 100/500/1,000-session device runs; independent PR57 then PR58 review and approvals; qualified exercise/AI review; licensed reviewed 3D/video assets (zero approved assets); coach operational acceptance; privacy/store/payment and production operations gates. Do not merge or label the experience DONE from this evidence.
