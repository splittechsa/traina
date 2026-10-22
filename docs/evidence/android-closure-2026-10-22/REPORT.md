# Traina Android UX and staging handoff — 2026-10-23

**Public launch NO-GO; experience PARTIAL.** Signed Android internal APKs now build and run on the requested PC emulator. This is actual native interaction against isolated staging with synthetic accounts. It is not physical-iPhone acceptance or independent professional/user review. No PR merge, production customer migration, live payment or store submission was performed.

## Product changes

Arabic text aligns correctly inside RTL containers; numbers remain readable. Active workouts expose pause in the header, compact weight/repetition controls and rest actions, set progress, technique guidance and final-set editing. Completed exercises hide unused inputs. Saved summary and record comparisons precede exercise details and count only logged work, including volume units and long-duration formatting. Membership capabilities/status, program muscles and training-library muscles use consumer-facing localized labels; internal recommendation scores are hidden. Settings uses a nonblocking language notice. The Android status-bar/keyboard coordinate fix keeps the login action above the keyboard. Release hydration ignores persisted developer LAN endpoints. SDK57-compatible patches/splash plugin pass Expo Doctor21/21.

## Actual native journeys and reconciliation

- **Signed emulator APK/source240c552:** started synthetic workout76a5145e-2fdc-4644-aad1-65aca2eaee65 from the native start action. Three taps dispatched in1,819ms including deliberate waits/ADB overhead; this is not input latency. Edited set3 from8 to9 repetitions at20kg, paused/resumed and confirmed completion. The server records exactly3 sets, one exercise,500kg total volume and the pause interval. The plan had12 sets; incomplete planned sets were correctly excluded. Saved summary and meaningful20×8→20×9 comparison appeared without generic failure. History and force-stop/relaunch retained the result.
- **Signed offline restart/source240c552:** separate synthetic session7ebddd96-406b-4148-9298-3c2f1b095e88, server0 sets. Disabled emulator Wi-Fi/data, logged3 native sets, force-stopped/reopened while offline. Completed sets remained visible without generic request error. Reconnect/foreground synchronized exactly3 sets once. See signed-offline-restart.json.
- **Expo Go/source d7e165d, separate earlier fixture:** native edit/pause, server6→9 offline reconciliation and deliberately dropped first successful completion response. Upstream200 was followed by actual app GET reconciliation approximately455ms later; saved summary showed without a false error. HTTPS completion replay preserved timestamp/sets and history/restart. This fault-injection evidence was not captured from the signed release binary; developer endpoint overrides are disabled in release.
- Signed recording signed-workout.mp4 is165.765s/H264/1080×2400 with visible Android timing overlay. Full decode passed with preserved variable-frame timestamps and zero error lines; the final decoded frame shows saved completion. The three earlier Expo Go recordings remain separately labeled. No passwords/tokens/customer records are included.

## Measured performance and limits

Baseline signed source5e0576a: actual native history accounts with100,500 and1,000 sessions each traversed4 pages of20. Their sequential warm-process PSS ended at233,025/278,373/318,328KiB; these are not controlled cold-process comparisons and must not be attributed directly to session count.

After force-stop, the1,000-session account traversed all50 pages. PSS was208,513KiB on page1,257,300 on page20, peaked261,266 and ended256,075 on page50; Older was disabled at the end. Memory did not grow once per retained page throughout this run, but this does not prove a universal heap bound. Server max40/default20, client schema max20, inactive cursor gcTime0 and an automated50-page cache test provide separate structural bounds. Activity cold launch was2,205ms; this is not first usable paint.

Emulator gfxinfo reported334/1,222 janky frames(27.33%), p95 frame53ms and anomalous GPU percentiles. Concurrent host activity/software emulator graphics are not controlled. **Smoothness/performance acceptance remains open**; no60FPS or physical-device claim. Signed-build artifacts/tests do not replace real-device profiling.

## Builds and checks

| Source | Profile | Status | EAS build |
| --- | --- | --- | --- |
| db8aaac | preview | FINISHED | [c4183d28-2419-49ff-b5fc-89298532be88](https://expo.dev/accounts/splittech/projects/sahhti/builds/c4183d28-2419-49ff-b5fc-89298532be88) |
| 240c552 | preview-emulator | FINISHED | [bdec93f1-cb4e-4398-aedb-cc1cb73000eb](https://expo.dev/accounts/splittech/projects/sahhti/builds/bdec93f1-cb4e-4398-aedb-cc1cb73000eb) |
| 5e0576a | preview | FINISHED | [fcab602d-4f8c-44a6-adc6-c978b2907f00](https://expo.dev/accounts/splittech/projects/sahhti/builds/fcab602d-4f8c-44a6-adc6-c978b2907f00) |

Final application source isdb8aaac; its difference from240c552 is the training-library muscle label. The final APK was installed using the delivered helper and is non-debuggable. The previously offline-reconciled3-set session completed from its native confirmation, showed saved summary without generic failure, and retained the same completion timestamp after force-stop/relaunch. That activity cold launch took1,437ms, not a first-paint measurement. A fresh training screenshot visually verifies Arabic muscle labels. Archive audits contain source hashes, zero forbidden paths/mismatches and exclude generated Android/iOS projects. APK hashes and final install smoke are delivered separately. Runtime0.1.0-staging.2. 393 automated tests passed:164 mobile/46 files,136 domain,81 API,8 admin,3 contracts,1 design tokens. Root/mobile typechecks and root build passed. Mobile lint:0 errors,5 existing warnings. Current-head CI is recorded in review-gates.json; required independent approvals remain absent.

## Staging services

API https://traina-staging-api.vercel.app/v1/health returned200; website https://traina-staging-www.vercel.app and admin https://traina-staging-admin.vercel.app returned200. Commercial readiness remains503, missing store_verifier. Isolated Neon projectsolitary-pond-59179148/databasetraina_staging has verified migrations0001–0035. Production project was not seeded or migrated. See deployment runbook for exact server/mobile variable names and build commands; secret values stay in hosting/DPAPI stores.

## Remaining gates before public release

| Gate | Required evidence / blocker |
| --- | --- |
| iPhone | Signed current-source physical journey/recordings; Apple Developer access unavailable. |
| Performance/usability | Actual Android hardware plus iPhone startup/navigation/FPS/memory, font-scale/screen-reader/reduced-motion and independent beginner/experienced tasks. Emulator jank remains unresolved. |
| Security | Three underlying dependency advisories remain open; see DEPENDENCY_SECURITY.md. No suppression or unsafe forced override. Independent authentication, replay/concurrency, isolation/history/migration review required. |
| Exercise media | Zero approved assets. Five prioritized licensed realistic demonstrations need provenance, qualified technical review and actual playback/cache acceptance. Pipeline/fallback is implemented, coverage is not claimed. |
| Coaching | Qualified exercise/Yazan review, assigned human-coach delivery/operational acceptance. An unassigned/empty screen is not delivered coaching. |
| Commercial/operations | Privacy/legal/store policies, billing sandbox/store verification, notification delivery, support, monitoring/restore/rollback and explicit production promotion. Live payments remain disabled. |
| Integration | Review PR57 before58; both draft, current-head independent approvals0. Do not merge or label transformation DONE from author/emulator evidence. |

Detailed screenshots: NATIVE_RTL_AUDIT.md. Native images/recordings and safe reconciliation JSON are in the delivered package; SHA256 manifest is regenerated after final handoff. Earlier setup/Expo-only reports are historical, not a claim that these remaining gates passed.
