# Functional audit (2026-10-10)

Scope: every route, interactive element, API endpoint and data path at `8b29d04`, read with CodeGraph and traced
through to the backend. Status key:
- **W**: working, calls the real API
- **P**: partial
- **NO-OP**: placeholder (toast-only or no handler)
- **HC**: hardcoded data
- **B**: broken

Fixes are tracked in issues #77–#90. Their verification lives in [the test matrix](../development/test-matrix.md).

## Summary
- **Everything that should call the backend does call it.** Every call in `web/src/lib/api/*.ts` reaches an existing
  endpoint. No endpoint returns fixed data. The companion, calendar, alerts and storage endpoints answer
  `503 *_not_configured` when their provider is missing, which is by design.
- **Verified defects:**
  1. `/settings` crashes. `useSettings()` throws because `SettingsProvider` is not mounted, and the page test hides
     this by wrapping its own provider. (#77)
  2. Profile fields are mapped inconsistently:
     - fields read in camelCase are never set, so relationship goal, location, height and show-age never display
     - saving display preferences turns a hidden age back on
     - saving the discovery sliders resets the gender preference to "both"

     (#78)
  3. Insights:
     - the range tabs drive the parent Profile tabs
     - two numbers are hardcoded (62% positive responses, 23% ghosting)
     - Profile, Insights, Calendar and Streaks swallow load errors

     (#79)
  4. Two fixed bottom navigation bars overlap; there is no desktop navigation. Links to the crashing `/settings` and a
     full-page navigation to `/feedback`. Photo controls only appear on hover. (#80)
  5. The avatar is the first photo even when it is hidden, so a hidden photo shows in matches, notifications,
     streaks and the block list. Onboarding flags can disagree. Upload size and type are declared by the client
     and never checked. (#81)
  6. API features without UI: unmatch, calendar disconnect, streak caption, read receipts, older companion messages.
     Dead code: the comment input, `AdvancedFilters.tsx` and `utils/dummyData.ts`. (#82)
  7. No image has lazy loading or an error fallback, and expired chat-media URLs break. AdSense is hardcoded with an
     empty ad slot. (#83)
- **Roles:** there is only the signed-in user. Reports can be filed but nobody can review them (#84, #85).
  `profiles.verified` is never written, so "verified profiles only" empties the feed. This is documented, not faked.
- **Data:**
  - There is no seed for local use (#87).
  - `scripts/db/seed-sample.sql` breaks the app's rules: onboarded users have 1 photo and the step is `done` (#87).
  - The Pexels key in `backend/.env` (`PEXEL_API_KEY`) is not read by any code (#86).
- **Tests:** E2E covers sign-up, photo upload and match/chat only. Most pages have no component tests (see the matrix).

## Routes (`web/src/App.tsx`)
All private routes go through `PrivateRoute`, which redirects signed-out users to `/login`. Unless noted, they also go
through `OnboardingGuard`, which redirects to `/onboarding` until onboarding is complete.

| Path | Page | Guard | Status |
|---|---|---|---|
| `/login`, `/signup`, `/forgot-password` | Login, Signup, ForgotPassword | Signed-in users are redirected | W |
| `/verify`, `/reset-password`, `/auth/callback` | Verify, ResetPassword, AuthCallback | public | W |
| `/calendar/callback` | CalendarCallback | private, no onboarding check | W (needs Google config) |
| `/onboarding` | Onboarding (6 steps, photos) | private, no onboarding check | W |
| `/discover` | Discover (deck, swipes, filters) | private | W; info panel fields P |
| `/matches` | Matches, chat overlay, notifications | private | W; unmatch and read receipts missing |
| `/ai-companion` | AI companion | private | W (needs `LLM_API_KEY`) |
| `/profile` | Profile, edit, photos, insights, calendar | private | P (#78, #79, #80) |
| `/streaks` | Streaks feed, post, like, leaderboard | private | W; caption missing; ads HC |
| `/settings` | Settings sections | private | **B** (#77) |
| `/safety` | Contacts, date plans, emergency alert | private | W (alerts need a provider) |
| `/feedback` | Feedback history | private | W |
| `/support`, `/terms`, `/privacy` | Text pages | private, public, public | Placeholder text: owner content needed |
| `*` | NotFound | public | W |

## Elements that are not fully working
| Page | Element | Status | Evidence |
|---|---|---|---|
| Settings | whole page | B | `context/SettingsContext.tsx:96`; provider not mounted in `main.tsx`/`App.tsx` |
| Settings | theme, language, sound, haptics, animations, accessibility, notifications switch, AI voice/frequency | P: stored, but nothing in the app applies them | `AppCustomization.tsx`, `AccessibilitySettings.tsx`, `CommunicationSettings.tsx` |
| Settings | Contact Support | NO-OP (toast says "future update") | `FeedbackSupport.tsx:403` |
| Profile | Insights range tabs | B | `ProfileInsights.tsx:69-91` |
| Profile | Positive responses / ghosting | HC | `ProfileInsights.tsx:275,287` |
| Profile | details panel fields | P | `ProfileDetails.tsx:10,19` (camelCase) |
| Profile | display preferences save | B (re-shows hidden age) | `ProfileEditContent.tsx:48` |
| Profile | discovery sliders save | B (resets gender preference) | `ProfileFilterPreferences.tsx:60-65`, `services/profiles/profile-preferences.ts:32` |
| Profile | calendar date picker | NO-OP | `ProfileCalendar.tsx:101-120` |
| Profile | calendar "Connected" | NO-OP (no disconnect UI) | `ProfileCalendar.tsx`, `use-google-calendar.ts:288` |
| Profile | Google events on mount | P (loads before the status is known) | `ProfileCalendar.tsx:29-31` |
| Profile | "Configure Safety Features" | B (goes to `/settings`) | `ProfileCalendarContent.tsx:16` |
| Discover | info panel location, goal, height | P | `ProfileDisplay.tsx:16`, `ProfileInfoPanel.tsx:66,73` |
| Discover | comment input | NO-OP, unreachable | `ProfileCommentInput.tsx:11-17` |
| Matches | unmatch | missing (API exists) | `lib/api/discovery.ts:64` |
| Matches | read receipts | missing (API exists) | `MessageItem.tsx` |
| Matches | send failure | P (input clears anyway) | `MessageInput.tsx:149-176` |
| Streaks | caption | missing (API accepts it) | `StreakPostForm.tsx` |
| Streaks | ads | HC third party | `StreaksList.tsx:33,43`, `web/index.html` |
| Companion | older history | missing (API supports `before`) | `AICompanion.tsx:38-46` |
| Global | two bottom bars | B (overlap) | `MobileNavigation.tsx`, `Navbar.tsx` |
| Global | images | P (no lazy loading or fallback) | all `<img>` |

## API (`docs/api/openapi.json`)
All 41 paths are implemented. Gaps:
- avatar privacy (above)
- client-declared upload size and type
- onboarding flag consistency
- no moderation endpoints
- `verified` and `email_verified` have no writer in this architecture
- rate limits are per process (documented in `docs/security.md`)
- `ensure_profile` writes on every request

## Data and configuration
- **Pexels:** `Settings` ignores unknown keys (`extra="ignore"`), so `PEXEL_API_KEY` in `backend/.env` is never read.
- **Age rule:** 18+ is enforced by the API, not by a database constraint in the Alembic schema. SQL seeds can bypass
  it, so seeding must go through the API.
- **Accepted image URLs:**
  - Profile photos are accepted only as paths in the user's own Storage folder.
  - The database and the CSP (`img-src … https:`) would accept external URLs.
  - Seeded photos are therefore uploaded through the real signed-upload flow.
