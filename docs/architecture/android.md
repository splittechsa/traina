# Native Android architecture

Not compiled. The Android SDK and `kotlinc` are not installed here.

## Intended app

Kotlin, Jetpack Compose, Coroutines, Health Connect, Play Billing, the Android Keystore, Room for the offline queue, WorkManager, CameraX, and FCM.

Feature parity with iOS is the goal. Navigation should follow Material 3 rather than copy the iOS tab structure where the platforms differ.

## Modules

The same boundaries as iOS: onboarding, training, nutrition, coach, membership, and a Room outbox that cannot complete a workout the server already closed.

Play Billing purchases are unverified until a Play developer notification is checked on the server. The 501 billing route is that gap today.

## Blocked on

A Play Console app, signing, billing products, Health Connect declarations, and a data-safety form.
