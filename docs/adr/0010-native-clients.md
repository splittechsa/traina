# ADR 0010 — Native clients are separate apps

## Status

Superseded for the member iOS and Android clients by ADR 0012. Admin and gym portal guidance in this record still stands. The apps were not built under this decision.

## Decision

iOS will be SwiftUI and Android will be Jetpack Compose. A WebView wrapper is not the product. Web admin and the gym portal are separate Next.js applications when they are built.

This machine has no Swift toolchain and no Android SDK, so no mobile binary is claimed.

## Consequences

Mobile apps will call the versioned HTTP API. They will not embed database credentials or compute commissions.
