# ADR 0012 — Expo is the member client

## Status

Accepted. Supersedes the iOS and Android client choice in ADR 0010. Web admin and the gym portal remain separate applications and are still not built.

## Decision

The member application is Expo SDK 57 with React Native, TypeScript strict mode, and Expo Router. It is not a WebView. iOS binaries are produced with EAS Build on Apple's cloud macOS. Android binaries are produced with EAS Build. A local Mac is not part of the standard workflow.

Custom native modules use a development build. Expo Go is only for JavaScript that those modules do not require.

## Consequences

`apps/mobile` is source. No iOS or Android binary has been compiled in this repository. `eas init` has not been run, so there is no EAS project id. Store submission is not started.
