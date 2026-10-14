# Sahhti product audit

Audit of the repository at `C:\Users\Ahmed\Desktop\app` before the sports-identity pass. This describes the product as it was, not a proposal.

## Stack

- Mobile: Expo SDK 57, React Native 0.86, Expo Router, TypeScript, React Query, Reanimated, Gesture Handler, Safe Area, Haptics, SVG, IBM Plex Sans Arabic.
- API: Fastify, session auth, scrypt passwords, six-digit email codes.
- Database: Neon Postgres. Migrations `0001`–`0006` are applied. Profiles store one discipline, one experience, age, height, weight, sessions per week, environment, activity, and diet tags. Goals are separate rows. Workout sessions already distinguish strength, CrossFit, and calisthenics prescriptions.
- No chart library is installed. No native wheel-picker package is installed.

## What already works and must stay

- Email registration, verification, resend, password reset, and session restore.
- Onboarding save, idempotent repeat save, and the gate that opens Home only after `/v1/me` confirms a profile.
- Training sessions, set logging, nutrition diary, community posts, and the coach route through the backend provider.
- Arabic-first copy with an English dictionary. RTL is set from the locale.

## Navigation and layout

- Primary tabs are Home, Training, Nutrition, Coach, and Community. Progress is a secondary screen, so the daily product is not the athlete journey the tabs suggest.
- The tab bar is docked to the bottom and includes the safe-area inset in its measured height.
- Auth no longer shows a server URL. Diagnostics exist only in development builds.
- Onboarding still opens with five full-screen photos, then places every later choice on another photograph. Forms, keyboards, and clipped horizontal chips are the main layout risk.
- Community is a real feed, but it occupies a primary tab before training depth does.

## Sports model

- Domain disciplines: bodybuilding, powerlifting, CrossFit, calisthenics, functional training, general fitness, hybrid.
- Goals: cutting, fat loss, bulking, muscle gain, recomposition, strength, endurance, general health.
- Running and boxing are not stored. A member can save only one discipline. Bulking and bodybuilding are not separated in the setup screens: the person picks a goal and, on a later step, one discipline.
- Workout logging is still primarily weight and repetitions, with extra prescription shapes for CrossFit and calisthenics that the phone does not fully expose.

## Visual system

- Both “light” and “dark” palettes are dark charcoal with a lime accent (`#C7F36B`). Lime is a common fitness-app color and is close to a generic athletic dashboard.
- Buttons, chips, and the photo call-to-action repeat that lime. Borders are restrained. Arabic type is already IBM Plex Sans Arabic.
- There is no original motif beyond the photography.

## Gaps that are not bugs

- No invented readiness score, food database, or generated training plan exists. Empty states say so.
- Email delivery is unconfigured unless Resend is set on the API.
- Coach replies are one JSON response, not a streamed conversation.
- Subscription code exists in the domain package and is not a store purchase flow in the phone app.

## Implication

The next change should retune the identity, move Progress into the primary tabs, and rebuild setup so sport and goal are separate choices that still save through the existing profile. New sports need an additive column. They must not replace the current discipline field or existing rows.
