# Native iOS architecture

Not compiled. `swift` is not installed on the machine that created this repository.

## Intended app

SwiftUI, Swift Concurrency, HealthKit, StoreKit 2, Keychain, BackgroundTasks, APNs, and the system camera. The primary experience is native, not a WebView.

## Modules

- `App` — navigation shell following iOS conventions, Arabic RTL via layout direction.
- `Onboarding` — submits the onboarding contract; does not invent a calorie target.
- `Training` — offline set queue that reconciles with `applyOfflineSet` semantics.
- `Nutrition` — diary and a scanner pipeline that labels image results as estimates.
- `Coach` — renders structured tool results. It does not embed a database password or a service-role key.
- `Membership` — StoreKit 2 purchase, then a server verifier. The app does not mark a payment successful from a local callback alone.
- `Design` — tokens from `packages/design-tokens`, with SF Pro and IBM Plex Sans Arabic where licensed files are added.

## Blocked on

An Apple Developer account, a bundle id, signing, App Store Connect products, a privacy nutrition label, and a Mac build host.
