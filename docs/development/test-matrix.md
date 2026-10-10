# Test coverage matrix

Maps each page, feature and role to the tests that exercise it and their latest result. A row is complete only when
a real test passes or a limitation is documented. The notes column records what is not verified and why.

Test types:
- **U:** web unit or component test (Vitest, `web/src/**/*.test.*`)
- **A:** API test (pytest on real Postgres, `backend/tests/`)
- **E:** end-to-end (Playwright, `e2e/`)

Roles:
- **user:** a signed-in user
- **new:** signed up but not onboarded
- **mod:** a moderator
- **anon:** signed out

Last updated: 2026-10-10 (#89). Every E2E spec runs at mobile, tablet and desktop sizes with the error guard on, in
CI on a seeded stack.

## Authentication
| Feature | Roles | Tests | Result | Notes |
|---|---|---|---|---|
| Sign up and email confirmation | anon | E `signup.spec.ts`; U `authSchema.test.ts`, `EmailConfirmationNotice.test.tsx` | pass | – |
| Login and logout, including a refused password | anon, user | E `auth.spec.ts` | pass (#89; log out no longer sends unauthenticated requests, #113) | – |
| Session persists across reload; signed-out users are sent to sign in | user, anon | E `auth.spec.ts` | pass (#89) | – |
| Forgot / reset password | anon | U `ForgotPassword.test.tsx`, `ResetPassword.test.tsx`; E `auth.spec.ts` (emailed link; the new password works, the old one is refused) | pass (#89) | – |
| Auth callback | anon | U `AuthCallback.test.tsx` | pass | – |
| Token verification (JWKS, HS256, expiry, audience) | – | A `test_auth_verifier.py` | pass | – |
| Route guards, start page after sign-in, 404 | anon, new, mod | U `App.test.tsx`, `start-page.test.ts`; E `auth.spec.ts`, `onboarding.spec.ts`, `moderation.spec.ts`, `permissions.spec.ts` | pass (#89, #109) | – |

## Onboarding and profile
| Feature | Roles | Tests | Result | Notes |
|---|---|---|---|---|
| Onboarding steps, completion rules | new | A `test_profiles.py`; U `OnboardingPersonality.test.tsx`; E `onboarding.spec.ts` (every step in the browser, resume after reload, saved answers) | pass (#78; #89 fixed lost taps on lifestyle options, labelled the birth date selects, exposed option state) | – |
| 18+ only | new | A `test_profiles.py` | pass | The year list stops at 18 years ago; a birthday later in that year is refused by the API. Not walked in E2E |
| Photo upload, remove, reorder, visibility; stored file checked (size, type) | user | A `test_profiles.py`, `test_uploads.py`; E `photos.spec.ts`, `profile.spec.ts` (hide a photo) | pass (#80, #81, #89) | – |
| Profile details display | user | U `profile-view.test.ts`, `ProfileDetails.test.tsx`; E `profile.spec.ts` | pass (#78, #89) | – |
| Display preferences (display name, show age) | user | U `profile-view.test.ts`; E `profile.spec.ts` | pass (#78; #89 saves the display name as `display_name` instead of overwriting the account name) | – |
| Profile load failure | user | U `Profile.test.tsx` | pass (#79) | – |
| Discovery preferences (age, distance, gender) | user | A `test_discovery.py`; U `ProfileFilterPreferences.test.tsx`, `useDiscoverProfiles.test.ts`; E `discover.spec.ts` | pass (#78, #89) | – |
| Insights (week, month, year) | user | A `test_insights.py`; U `ProfileInsights.test.tsx`; E `profile.spec.ts` | pass (#79, #89) | – |
| Calendar: date plans, Google connect and disconnect | user | A `test_calendar.py`, `test_safety.py`; U `CalendarCallback.test.tsx`, `ProfileCalendar.test.tsx`; E `profile.spec.ts` (unconfigured state), `safety.spec.ts` (date plans) | pass (#79, #89) | Connecting a real Google account is not verified (no OAuth client) |
| Avatar respects photo visibility | user | A `test_profiles.py`, `test_migrations.py` (0006 backfill) | pass (#81) | – |

## Discovery, matches and chat
| Feature | Roles | Tests | Result | Notes |
|---|---|---|---|---|
| Feed filters, paging, blocks, distance | user | A `test_discovery.py`; U `useDiscoverProfiles.test.ts`; E `discover.spec.ts`, `match-and-chat.spec.ts` (seeded feed) | pass | – |
| Swipe and mutual match (including concurrency) | user | A `test_discovery.py`; E `match-and-chat.spec.ts`; DB `supabase/test` | pass | – |
| Info panel fields | user | U `profile-view.test.ts`; E `chat-safety.spec.ts` | pass (#78, #89) | – |
| Matches list, unmatch | user | A `test_discovery.py`; U `InlineChatHeader.test.tsx`; E `match-and-chat.spec.ts` | pass (#82) | – |
| Chat send, receive, paging, read receipts | user | A `test_messages.py`; U `useInlineChat.test.ts`, `MessageItem.test.tsx`; E `match-and-chat.spec.ts` | pass (#82, #83) | Photo and voice messages: A and U tests only |
| Block and report from chat | user | A `test_safety.py`; U `ReportUserDialog.test.tsx`; E `chat-safety.spec.ts` | pass (#89) | – |
| Notifications | user | A `test_notifications.py`; U `NotificationBell.test.tsx`; E `notifications.spec.ts` | pass (#89) | – |

## Streaks, companion, safety, settings, feedback
| Feature | Roles | Tests | Result | Notes |
|---|---|---|---|---|
| Streak post with caption, like, leaderboard, expiry job | user | A `test_streaks.py`; U `StreakPost.test.tsx`, `StreakPostForm.test.tsx`, `use-streaks-actions.test.ts`, `Streaks.test.tsx`; E `streaks.spec.ts` | pass (#79, #82, #89) | – |
| AI companion | user | A `test_companion.py`; U `AICompanion.test.tsx`; E `companion.spec.ts` (unavailable state) | pass | Replies from a real LLM provider are not verified (no key) |
| Safety contacts, date plans | user | A `test_safety.py`; U `use-safety-contacts.test.ts`; E `safety.spec.ts` | pass (#89) | – |
| Emergency alert (no provider) | user | A `test_safety.py`; U `EmergencyButton.test.tsx`; E `safety.spec.ts` | pass (honest 503) | Delivery to contacts is not verified (no provider) |
| Settings page; a setting persists; unblock | user | U `App.test.tsx`, `Settings.test.tsx`; E `settings.spec.ts` | pass (#77, #89) | – |
| Other settings sections (location, theme, language, accessibility, AI style) | user | U `SettingsContext.test.tsx`, `mapping.test.ts`; A `test_safety.py` | pass | U and A only |
| Feedback: send, then history | user | A `test_insights.py`; E `settings.spec.ts` | pass (#89; the category field is now labelled) | – |

## Moderation and permissions
| Feature | Roles | Tests | Result | Notes |
|---|---|---|---|---|
| Report review queue and status changes (reviewer, time, note; no self-review) | mod | A `test_moderation.py`; seed `verify` (queue has the seeded reports); U `Moderation.test.tsx`; E `moderation.spec.ts` (moderator granted with the operator CLI reviews a report in the browser) | pass (#84 API, #85 page) | – |
| Non-moderators cannot moderate; roles only via the operator CLI | user | A `test_moderation.py` (403, revoked role, CLI grant/revoke/list, email lookup); seed `verify`; U `App.test.tsx`, `AppNavigation.test.tsx`, `use-roles.test.ts`; E `moderation.spec.ts` (no link, "Moderators only", API 403) | pass (#84, #85) | – |
| Cross-user access (photos, chats, contacts, plans; unfinished profiles; no session) | user, anon | A `test_profiles.py`, `test_messages.py`, `test_safety.py`; E `permissions.spec.ts` | pass (#89) | – |

## Cross-cutting
| Feature | Tests | Result | Notes |
|---|---|---|---|
| Navigation, one bar on every viewport | U `AppNavigation.test.tsx`; E every spec at mobile, tablet and desktop | pass (#80, #88) | – |
| Responsive layout at mobile, tablet and desktop | E all specs in projects `mobile`, `tablet`, `desktop` | pass (#88; every page since #89) | – |
| No console errors, page errors or 5xx responses during journeys | E guard fixture on every test (`support/fixtures.ts`), self-checked by `guard.spec.ts` | pass (#88) | – |
| Image loading and fallbacks; ads only when configured; useToast messages shown (#111); pages not remounted on re-render (#113) | U `SafeImage.test.tsx`, `MessageItem.test.tsx`, `AdSense.test.tsx`, `App.test.tsx`; built `index.html` and bundle checked for AdSense code with it unset (none) | pass (#83, #100) | – |
| Security headers, CORS, rate limits, body size; configuration errors never echo values | A `test_hardening.py` | pass | – |
| Seed accounts: run, verify, reset | A `test_seed.py` (persona rules, production/remote refusal); `SEED=1 scripts/e2e.sh` (run twice, verify, E2E on top); reset checked on a kept stack (0 seed profiles, files, auth users left) | pass (#87; CI runs E2E seeded since #88, with placeholder photos unless a `PEXELS_API_KEY` secret is set) | – |
| Pexels key stays on the server | A `test_pexels.py` (key only in the API header, never in errors or settings repr); build and repository grep | pass (#86) | – |
