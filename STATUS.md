# Implementation status

Checked on this Windows machine on 2026-10-12.

## Verified in this session

The iPhone message `Request failed` was reproduced from this PC. `POST http://192.168.8.39:3000/v1/auth/login` returned `503` with `{"error":{"code":"AUTH_NOT_CONFIGURED"}}` and no message. The app prints `Request failed` when the body has no message. Port 3000 is also shared with another Node process, so it is not a safe port for Sahhti.

A separate API was started with `npm run dev:api`. It listens only on port 3040, uses file-backed PGlite in `.data/pglite`, and reports `"auth":"session"`. From `http://192.168.8.39:3040` this PC registered an account, verified it, signed in, restarted the API process, and signed in again. The account survived the restart.

That is not a tap on the physical iPhone. The phone still needs the steps in [docs/architecture/expo-windows.md](docs/architecture/expo-windows.md).

Commands that passed:

- `npm test` at the repository root: 90 tests (56 domain, 2 contracts, 1 design token, 31 API).
- `npm run typecheck` for the API.
- `npm test` in `apps/mobile`: 15 tests.
- `npx tsc --noEmit` in `apps/mobile`.
- `npx expo-doctor` in `apps/mobile`: 21 of 21 checks passed after removing the unsupported `newArchEnabled` key. SDK 57 already uses the new architecture.

`npm audit` at the repository root previously reported 0 vulnerabilities. `npm audit` in `apps/mobile` previously reported 24 vulnerabilities in Expo and Metro. `npm audit fix --force` would downgrade Expo and was not run. No new compatible Expo release was applied in this session.

| Area | State | Evidence |
| --- | --- | --- |
| Sign-in error on the phone | Cause found, API corrected, phone not retested | 3000 returned `AUTH_NOT_CONFIGURED`. 3040 completes register, verify, and login |
| Session data across API restart | Verified on Neon | After a process restart, Neon still had 2 users, 1 profile, 2 credential rows, 7 sessions, 2 weight rows, and 4 migration records |
| Neon PostgreSQL | Connected for the API | Organization Split, project health app, branch production. Postgres 18.6 in `aws-us-east-2`. The phone does not receive the URL. See [docs/adr/0015-neon.md](docs/adr/0015-neon.md) |
| Supabase | Not selected | Auth would duplicate the existing sessions. Free plan pauses after inactivity |
| Store billing and settlement | Still refused | Verify returns 501. Settle returns 503 |
| AI model | Ready, not called | Set `SAHHTI_COACH_PROVIDER=openai_compatible` plus `SAHHTI_COACH_API_KEY`, `SAHHTI_COACH_BASE_URL`, and `SAHHTI_COACH_MODEL`. No live provider request has succeeded. |
| iOS and Android binaries | Not compiled | No EAS project |
| One million users | Not validated | `scale.validated` is false |
| Saudi hosting and PDPL | Not claimed | Neon regions were not verified as inside Saudi Arabia |

The development mailbox returns a verification token to the registering client only when the process is not production. Production still refuses the outbox.

## Onboarding loop

Fixed in code on 2026-10-11. Not yet confirmed by a tap on the iPhone.

Root cause: after a successful save, the app returned to `/` and the route guard reused a cached `/v1/me` response that still said the profile was missing. It redirected to Profile setup before the new profile was read. The screenshot values (age 20, 195 cm, 100 kg, cutting, general fitness) are valid and are stored. An API test saves that profile, restarts the database, signs out, signs in, and still receives `onboardingCompleted: true`.

Reload Expo Go, then open the app again. If the profile was already saved, the dashboard should open without another save.

## Member app presentation

The member app uses an Arabic-first layout and IBM Plex Sans Arabic. Weight and progress lists use each row's database id, so two saves on the same day do not share a React key. Nutrition can search member-entered foods and scale them per 100 g. There is no reference food database, so unlabeled Saudi dishes are not calculated. Community text posts, comments, support, and blocks work. Media storage is not configured. The coach stays unavailable until the four provider variables are set, and it does not invent a reply. Exercise photos are still absent because `demonstrationMedia` is null. These phone changes have not been confirmed on the device again.

## Stuck “Sahhti” screen

Seen on the iPhone at 12:31: title “Sahhti” and “The request could not be completed”, with no retry. That is the start-screen error after `/v1/me` fails. The saved API address lived only in memory after sign-in, so a reload asked `127.0.0.1` on the phone before the login screen could restore it. The session stayed, so the screen never offered sign-in or another address.

The start screen now restores `sahhti.apiBase` before that request. If it still fails, the screen shows the real reason, the API field, Try again, and Sign out. Not confirmed on the phone. The API on port 3040 was still reporting `auth: session` when this was written. Port 3000 is still the older process and is the wrong address.
