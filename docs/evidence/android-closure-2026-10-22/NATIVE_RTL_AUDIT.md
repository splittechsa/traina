# Screenshot-based native RTL audit — 2026-10-23

Scope: the requested priority consumer surfaces, actually opened on Android API36 / Pixel7 emulator in Expo Go against isolated staging with a synthetic member. This extends the earlier **source-only** inventory; it does not claim full physical-iPhone, release-binary, accessibility or independent-human acceptance. Images are in the delivered local evidence package and its hash manifest. The Expo Go Tools bubble is development UI, not a Traina control.

| Surface | Captured image | Observation / disposition |
| --- | --- | --- |
| Home | route-home.png | Arabic leading content and action hierarchy observed; tab labels readable. |
| Profile edit | route-profile.png | Arabic field label starts right; editable user-provided names retain their script. Save and keyboard need signed-build follow-up. |
| Account | route-account.png | Avatar/info at locale start, settings icons leading, disclosure arrows trailing; export/delete actions not exercised in this visual audit. |
| Settings | 21-settings-arabic-after-restart.png; 19-english-after-restart.png | Both directions captured; English persists after process restart. Blocking restart dialog replaced with inline notice. Native RTL mismatch still requires signed-build verification. |
| Membership | route-membership.png | Raw capability/status identifiers found and replaced with localized member-facing labels; purchase availability remains off. |
| Training/history | route-training.png;16-history.png | Bounded page and resume/history views observed; no generic navigation failure in the tested run. |
| Active workout |02-workout-before.png;03-rtl-adjusted.png;05-three-sets.png | Before/after text alignment verified; table columns stay RTL; numeric entry remains LTR/centered. Pause now accessible in the header. |
| Completion |15-final-summary.png;17-restart-summary.png | Saved summary and records moved before exercise list; actual logged-exercise count, units and duration clarified. |
| Programs |route-programs.png | Arabic templates/day actions and saved mixed-script program names remain legible; no automatic translation of user names. |
| Program edit/replacement |route-program-edit.png | English muscle identifiers found and localized, including replacement choices. Internal ranking scores removed from consumer copy. Existing bottom-sheet replacement preserved. |
| Nutrition |route-nutrition.png | RTL meal-section hierarchy and actions observed; empty totals remain honest. |
| Meal library/search |route-meal-library.png | Arabic search/recent-empty state observed. Gboard stylus overlay is an emulator input environment issue; no camera/barcode claim. |
| Progress |route-progress.png | RTL metrics/charts and actual recorded progress displayed. Long chart date labels ellipsize; further device/font-scale review remains open. |
| Yazan |route-coach.png | Arabic prompt chips/composer, empty state and quota readable. Clinical/coaching quality not accepted by this audit. |
| Weekly check-in/human feedback |route-weekly-checkin.png | Honest unassigned-coach/empty-data state rendered. Actual human-coach delivery and professional operational review remain **NOT_TESTED/BLOCKED**. |
| Notifications |route-notifications.png | Arabic empty state clearly separates human coach from Yazan. Delivery infrastructure not established by opening this screen. |

Auth keyboard follow-up:26-auth-keyboard-after.png exposed a remaining status-bar coordinate mismatch after the initial keyboard fix. Measured geometry was window838.476dp, screen914.286dp, status bar51.810dp, keyboard screenY577.905dp/height312.381dp. Corrected inset is312.381dp, clamped for edge-to-edge hosts and zero after window resize. In28-keyboard-final.png the login button bounds are[63,1375]–[1017,1517], with the keyboard beginning at approximately1517px: the complete action is visible. Six hook regression cases cover the observed geometry and resize/overlay behavior; no temporary geometry logging remains in source.

After SDK patch installation, a stale Metro file map briefly produced an expo-modules-core/uuid resolution error. A clean Metro restart rebuilt the bundle and the affected screenshots were recaptured. The final route JSON is a visible-state capture, not a substitute for manual screenshot review or complete interaction acceptance.

Remaining: physical iPhone and signed Android/native performance, all large-text/screen-reader/reduced-motion journeys, genuine reviewed exercise media and actual coach feedback. Do not mark the entire transformation DONE from this audit.
