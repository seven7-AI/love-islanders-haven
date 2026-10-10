# Test coverage matrix

Maps each page, feature and role to the tests that exercise it and their latest result. A row is complete only when
a real test passes or a limitation is documented. The issue column says what the issue does to that row.

Test types:
- **U:** web unit or component test (Vitest, `web/src/**/*.test.*`)
- **A:** API test (pytest on real Postgres, `backend/tests/`)
- **E:** end-to-end (Playwright, `e2e/`)

Roles:
- **user:** a signed-in user
- **new:** signed up but not onboarded
- **mod:** a moderator
- **anon:** signed out

Last updated: 2026-10-10 (#79).

## Authentication
| Feature | Roles | Tests | Result | Issue |
|---|---|---|---|---|
| Sign up and email confirmation | anon | E `signup.spec.ts`; U `authSchema.test.ts`, `EmailConfirmationNotice.test.tsx` | pass | – |
| Login and logout | anon, user | none | – | #89 adds E2E |
| Session persists across reload or new tab | user | none | – | #89 adds E2E |
| Forgot / reset password | anon | U `ForgotPassword.test.tsx`, `ResetPassword.test.tsx` | pass | #89 adds E2E |
| Auth callback | anon | U `AuthCallback.test.tsx` | pass | – |
| Token verification (JWKS, HS256, expiry, audience) | – | A `test_auth_verifier.py` | pass | – |
| Route guards (signed out → login, not onboarded → onboarding), 404 | anon, new | U `App.test.tsx` | pass | #89 adds E2E |

## Onboarding and profile
| Feature | Roles | Tests | Result | Issue |
|---|---|---|---|---|
| Onboarding steps, 18+, completion rules | new | A `test_profiles.py`; U `OnboardingPersonality.test.tsx`; E `signup.spec.ts` (start only) | pass (relationship goal values fixed in #78) | #89 adds a full E2E walk-through |
| Photo upload, remove, reorder, visibility | user | A `test_profiles.py`; E `photos.spec.ts` | pass | #80 makes controls touch-usable; #89 adds E2E |
| Profile details display | user | U `profile-view.test.ts`, `ProfileDetails.test.tsx` | pass (fixed in #78) | #89 adds E2E |
| Display preferences (name, show age) | user | U `profile-view.test.ts` | pass (hidden-age reset fixed in #78) | #89 adds E2E |
| Profile load failure | user | U `Profile.test.tsx` | pass (error with retry instead of a placeholder profile, #79) | – |
| Discovery preferences (age, distance, gender) | user | A `test_discovery.py`; U `ProfileFilterPreferences.test.tsx`, `useDiscoverProfiles.test.ts` | pass (gender reset fixed in #78) | #89 adds E2E |
| Insights (week, month, year) | user | A `test_insights.py`; U `ProfileInsights.test.tsx` | pass (tabs and hardcoded figures fixed in #79) | #89 adds E2E |
| Calendar: date plans, Google connect and disconnect | user | A `test_calendar.py`, `test_safety.py`; U `CalendarCallback.test.tsx`, `ProfileCalendar.test.tsx` | pass (error state and disconnect added in #79) | #89 adds E2E (unconfigured state) |
| Avatar respects photo visibility | user | none | – | #81 |

## Discovery, matches and chat
| Feature | Roles | Tests | Result | Issue |
|---|---|---|---|---|
| Feed filters, paging, blocks, distance | user | A `test_discovery.py`; U `useDiscoverProfiles.test.ts` | pass | #89 adds E2E with seeded users |
| Swipe and mutual match (including concurrency) | user | A `test_discovery.py`; E `match-and-chat.spec.ts`; DB `supabase/test` | pass | – |
| Info panel fields | user | U `profile-view.test.ts` | pass (fixed in #78) | #89 adds E2E |
| Matches list, unmatch | user | A `test_discovery.py` | pass (API only) | #82 adds the UI; #89 adds E2E |
| Chat send, receive, paging, media, read receipts | user | A `test_messages.py`; U `useInlineChat.test.ts`; E `match-and-chat.spec.ts` | pass (no read-receipt UI) | #82, #83, #89 |
| Block and report from chat | user | A `test_safety.py`; U `ReportUserDialog.test.tsx` | pass | #89 adds E2E |
| Notifications | user | A `test_notifications.py`; U `NotificationBell.test.tsx` | pass | #89 adds E2E |

## Streaks, companion, safety, settings, feedback
| Feature | Roles | Tests | Result | Issue |
|---|---|---|---|---|
| Streak post, like, leaderboard, expiry job | user | A `test_streaks.py`; U `StreakPost.test.tsx`, `use-streaks-actions.test.ts`, `Streaks.test.tsx` | pass (load error state added in #79) | #82 adds the caption; #89 adds E2E |
| AI companion | user | A `test_companion.py`; U `AICompanion.test.tsx` | pass (mocked LLM; live provider not verified) | #82 adds older history; #89 adds E2E of the unavailable state |
| Safety contacts, date plans | user | A `test_safety.py`; U `use-safety-contacts.test.ts` | pass | #89 adds E2E |
| Emergency alert (no provider) | user | A `test_safety.py`; U `EmergencyButton.test.tsx` | pass (honest 503) | – |
| Settings page | user | U `App.test.tsx` (real providers), `Settings.test.tsx` | pass (fixed in #77) | #89 adds E2E |
| Settings sections (privacy, blocks, location, preferences, AI, feedback) | user | U `SettingsContext.test.tsx`, `mapping.test.ts`; A `test_safety.py` | pass (API) | #89 adds E2E |
| Feedback | user | A `test_insights.py` | pass | #89 adds E2E |

## Moderation and permissions
| Feature | Roles | Tests | Result | Issue |
|---|---|---|---|---|
| Report review queue and status changes | mod | none (feature missing) | – | #84, #85 |
| Non-moderators cannot moderate | user | none | – | #84, #89 |
| Cross-user access (other users' photos, chats, contacts) | user | A `test_profiles.py`, `test_messages.py`, `test_safety.py` | pass | #89 adds E2E |

## Cross-cutting
| Feature | Tests | Result | Issue |
|---|---|---|---|
| Navigation, one bar per viewport | none | **broken** (two bars overlap) | #80 |
| Responsive layout at mobile, tablet and desktop | E (mobile only) | partial | #88 |
| No console errors or 5xx responses during journeys | none | – | #88 |
| Image loading and fallbacks | none | – | #83 |
| Security headers, CORS, rate limits, body size | A `test_hardening.py` | pass | – |
| Seed accounts: run, verify, reset | none | – | #87 |
| Pexels key stays on the server | none | – | #86 |
