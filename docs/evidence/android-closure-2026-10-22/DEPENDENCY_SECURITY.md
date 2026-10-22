# Dependency review — 2026-10-23

Commercial launch remains NO-GO; this is an author triage, not independent security approval.

SDK57 configuration was migrated from the removed top-level `splash` field to the `expo-splash-screen` plugin. Compatible Expo, Router and Notifications patch releases were installed using Expo CLI; the native runtime version was advanced to `0.1.0-staging.2`. Expo Doctor now passes **21/21** checks. No major SDK migration or forced downgrade was applied.

`npm audit --omit=dev` still reports 18 affected dependency graph nodes (15 high, 3 moderate), arising from three underlying advisories. The count includes Expo build tooling pulled through production dependencies; it is not evidence that all those packages ship in the Android JavaScript bundle. Reachability and release exceptions require independent review.

| Underlying package | Advisory / disposition |
| --- | --- |
| braces <=3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): nested-pattern stack exhaustion; upstream lists no patched version. Used transitively by Metro file matching. Remains open. |
| node-forge <=1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv): RSA signature verification issue; upstream lists no patched version. Expo CLI/code-signing dependency chain remains open; no claim of Android runtime exploitation or absence of exposure. |
| decode-uri-component <=0.4.2 | [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr): malformed URI decoding can consume excessive CPU. Patched0.5.0 is ESM; SDK57 Router currently depends on CommonJS query-string7.1.3/decode-uri-component0.2.2. An untested override would change module/API compatibility. Requires a supported upstream update or reviewed backport and malformed-link regression coverage. Remains open. |

Npm's suggested forced fixes include downgrading Expo to44 and React Native to0.72, or upgrading Router to58 independently of SDK57. Those are not acceptable unreviewed release fixes. No audit finding was suppressed. Internal testing uses isolated staging and synthetic accounts; no customer/production rollout or live payments are enabled. This dependency review must be closed alongside the existing independent security and platform gates before commercial release.
