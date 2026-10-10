# Seed accounts and data

`backend/seed` creates deterministic, fictional accounts and activity for **local and dedicated test stacks**. Every
record is created through the real flows:
- Supabase Auth: admin user creation, then password sign-in.
- The Love Islander API: profile, onboarding, signed photo uploads, swipes, messages, streaks, safety and feedback.

So the API's validation and rules apply exactly as they do for real users. Nothing is written to the database
directly.

## Accounts
All accounts share the password `LoveIsland-Seed-2026!`. You can override it with `SEED_PASSWORD`. It is a
local-only test credential, and the emails use the reserved `.test` domain.

| Email | State | What it exercises |
|---|---|---|
| `amani@seed.loveislander.test` | onboarded, full profile, location | Main demo account. Matches with Brian (read chat) and Daniel (unread messages). A chat image from Brian. Likes from Kevin and Juma waiting in Discover. A streak post. 2 safety contacts and an upcoming date plan. Has blocked Eric. Has sent feedback |
| `brian@seed.loveislander.test` | onboarded | Matched with Amani; sent a chat image; liked Amani's streak |
| `daniel@seed.loveislander.test` | onboarded | Matched with Amani; his messages are unread; streak post |
| `kevin@seed.loveislander.test` | onboarded | Matched with Grace (conversation); has liked Amani |
| `juma@seed.loveislander.test` | onboarded | Has liked Amani (appears in her Discover) |
| `eric@seed.loveislander.test` | onboarded | Blocked by Amani; reported for harassment by Lydia |
| `grace@seed.loveislander.test` | onboarded | Matched with Kevin; streak post liked by Amani and Kevin |
| `lydia@seed.loveislander.test` | onboarded | Reporter: reported and blocked Eric |
| `faith@seed.loveislander.test` | onboarded, minimal profile | Only the fields onboarding requires and 4 photos; no location |
| `sam@seed.loveislander.test` | onboarded, no location | Distance filtering for a user who never shared a location |
| `wanjiku@seed.loveislander.test` | onboarding stopped at photos | 2 of the 4 required photos; redirected to onboarding |
| `newcomer@seed.loveislander.test` | signed up only | Profile created on first sign-in, onboarding not started |

The personas live in Nairobi: city "Nairobi, Kenya" and nearby coordinates. The definitions are in
`backend/seed/personas.py`.

A moderator account is added with the moderator role (#84).

## Running it
Against the end-to-end stack, which starts everything, seeds twice, verifies, then runs the E2E suite:

```bash
SEED=1 npm run test:e2e
```

Against a local stack you started yourself ([setup](setup.md), Option A), with the API on port 8001:

```bash
cd backend
eval "$(npx supabase@2.120.0 status -o env | sed 's/^/export SB_/')"
export SUPABASE_URL=$SB_API_URL SUPABASE_ANON_KEY=$SB_ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SB_SERVICE_ROLE_KEY
uv run python -m seed run      # create or complete the seed data; safe to repeat
uv run python -m seed verify   # check the expected states through the API; exit 1 on any difference
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/love_islander uv run python -m seed reset
```

- **`run` is idempotent.** It reuses existing accounts, uploads only missing photos, and skips conversations, posts,
  contacts and plans that already exist.
- **Streak posts last 72 hours,** and one can be posted per day. A later run adds the day's post again.
- **`reset` deletes only accounts with the seed email domain,** plus their database rows (cascading from `profiles`),
  their files in `profile-images` and `chat-media`, and their auth users.

## Safety
- **Production:** the tool refuses to run when `ENVIRONMENT=production`.
- **Non-local targets:** it also refuses when `SUPABASE_URL` or `SEED_API_URL` points anywhere other than localhost,
  unless `--allow-remote` is passed for a dedicated test stack.
- **Rate limits:** the API's rate limits stay on. The tool waits out `429` responses using `Retry-After`.
- **Pexels key:** read from `PEXELS_API_KEY` (or `PEXEL_API_KEY`) in `backend/.env`. It is used only to download
  pinned photo ids once. The downloads are cached in `backend/.seed-cache/` (git-ignored), so later runs work offline
  and do not use the Pexels quota.
- **Not in the API image:** `backend/seed` is excluded from it (`backend/.dockerignore`).

## Photo credits
All photos are from [Pexels](https://www.pexels.com), used under the [Pexels license](https://www.pexels.com/license/).
The people shown are models and are not associated with Love Islander; the seed profiles are fictional.

| Pexels photo | Photographer | Used for |
|---|---|---|
| [1804452](https://www.pexels.com/photo/women-s-black-and-red-cap-1804452/) | [Git Stephen Gitau](https://www.pexels.com/@git-stephen-gitau-302905) | amani (portrait) |
| [27769600](https://www.pexels.com/photo/mountains-hiking-hills-trails-27769600/) | [Radis B](https://www.pexels.com/@radis) | amani (interest) |
| [6747870](https://www.pexels.com/photo/white-ceramic-cup-with-coffee-6747870/) | [Rania  Alsahabi](https://www.pexels.com/@rania) | amani (interest) |
| [33733117](https://www.pexels.com/photo/elephants-on-the-savannah-in-maasai-mara-33733117/) | [Anjeline Madara](https://www.pexels.com/@madysuva) | amani (interest) |
| [7257963](https://www.pexels.com/photo/a-man-in-black-long-sleeves-wearing-a-flat-cap-7257963/) | [Enock  Mensah](https://www.pexels.com/@enock-mensah-26955977) | brian (portrait) |
| [38275739](https://www.pexels.com/photo/soccer-ball-on-green-field-at-sunset-38275739/) | [Jomon Kollannoor](https://www.pexels.com/@jomon-kollannoor-337112572) | brian (interest) |
| [31139336](https://www.pexels.com/photo/artistic-latte-with-heart-latte-art-on-wooden-table-31139336/) | [Magda Ehlers](https://www.pexels.com/@magda-ehlers-pexels) | brian (interest) |
| [978613](https://www.pexels.com/photo/grayscale-photo-of-bicycles-978613/) | [A J](https://www.pexels.com/@trearkforvinden) | brian (interest) |
| [38165826](https://www.pexels.com/photo/stylish-portrait-of-a-smiling-young-man-38165826/) | [Olumide Adekunle](https://www.pexels.com/@orangevisuals) | daniel (portrait) |
| [36979007](https://www.pexels.com/photo/vintage-nikon-film-camera-on-table-36979007/) | [indra projects](https://www.pexels.com/@indraprojectsofficial) | daniel (interest) |
| [10800255](https://www.pexels.com/photo/elephants-walking-on-a-brown-field-10800255/) | [Mary](https://www.pexels.com/@mary-154780734) | daniel (interest) |
| [28050045](https://www.pexels.com/photo/a-person-is-walking-on-the-beach-at-sunset-28050045/) | [Nhi Uyển](https://www.pexels.com/@nhi-uy-n-3029320) | daniel (interest) |
| [12980901](https://www.pexels.com/photo/man-wearing-blue-button-up-polo-12980901/) | [Oyetola Togunde](https://www.pexels.com/@oyetola-togunde-2904750) | kevin (portrait) |
| [37261939](https://www.pexels.com/photo/cooking-dumplings-on-a-stove-with-chopsticks-37261939/) | [Gu Ko](https://www.pexels.com/@gu-ko-2150570603) | kevin (interest) |
| [10354611](https://www.pexels.com/photo/close-up-photo-of-an-acoustic-guitar-10354611/) | [Brett Sayles](https://www.pexels.com/@brett-sayles) | kevin (interest) |
| [8111330](https://www.pexels.com/photo/people-playing-board-game-with-dice-8111330/) | [Pavel Danilyuk](https://www.pexels.com/@pavel-danilyuk) | kevin (interest) |
| [16047707](https://www.pexels.com/photo/portrait-of-smiling-man-16047707/) | [Fatima Yusuf](https://www.pexels.com/@fatima-yusuf-323522203) | juma (portrait) |
| [8454901](https://www.pexels.com/photo/white-and-pink-sole-of-a-running-shoes-8454901/) | [Mikhail Nilov](https://www.pexels.com/@mikhail-nilov) | juma (interest) |
| [35864991](https://www.pexels.com/photo/urban-basketball-court-with-graffiti-art-decor-35864991/) | [Anthony](https://www.pexels.com/@anthony-2156384221) | juma (interest) |
| [7558112](https://www.pexels.com/photo/brown-acoustic-guitar-7558112/) | [Ravi Sharma](https://www.pexels.com/@ravinepz) | juma (interest) |
| [5612323](https://www.pexels.com/photo/man-covering-his-eyes-from-sun-glare-5612323/) | [Thirdman](https://www.pexels.com/@thirdman) | eric (portrait) |
| [24390617](https://www.pexels.com/photo/cityscape-under-dramatic-sky-24390617/) | [Suheil Mohammed](https://www.pexels.com/@suheil-mohammed-1125026879) | eric (interest) |
| [4253293](https://www.pexels.com/photo/person-cooking-meat-on-black-pan-4253293/) | [cottonbro studio](https://www.pexels.com/@cottonbro) | eric (interest) |
| [18680706](https://www.pexels.com/photo/basketball-field-in-sunlight-18680706/) | [Le Do  Thanh Dat](https://www.pexels.com/@dat1208) | eric (interest) |
| [39598425](https://www.pexels.com/photo/portrait-of-smiling-woman-in-denim-jacket-at-night-39598425/) | [Elka Elias](https://www.pexels.com/@elka-elias-2164032779) | grace (portrait) |
| [6693728](https://www.pexels.com/photo/canvas-painting-materials-on-wood-surface-6693728/) | [Tara Winstead](https://www.pexels.com/@tara-winstead) | grace (interest) |
| [5928634](https://www.pexels.com/photo/a-close-up-shot-of-a-person-on-a-yoga-mat-at-the-beach-5928634/) | [Tima Miroshnichenko](https://www.pexels.com/@tima-miroshnichenko) | grace (interest) |
| [27860686](https://www.pexels.com/photo/coffee-cup-27860686/) | [FFC Aarman](https://www.pexels.com/@ffc-aarman-22995634) | grace (interest) |
| [33646629](https://www.pexels.com/photo/smiling-woman-outdoors-on-a-sunny-day-33646629/) | [Jaye Iyanu](https://www.pexels.com/@jayeiyanu) | lydia (portrait) |
| [18134314](https://www.pexels.com/photo/books-on-table-by-window-18134314/) | [Ball Snow](https://www.pexels.com/@ball-snow-680828666) | lydia (interest) |
| [34752112](https://www.pexels.com/photo/serene-ocean-sunset-with-reflective-waves-34752112/) | [Anh Khoa](https://www.pexels.com/@anh-khoa-2157475551) | lydia (interest) |
| [34806418](https://www.pexels.com/photo/adorable-outdoor-portrait-of-a-fluffy-chow-chow-puppy-34806418/) | [Alexander Mass](https://www.pexels.com/@rebornfilmes) | lydia (interest) |
| [12672215](https://www.pexels.com/photo/woman-in-stripe-shirt-smiling-12672215/) | [Muhammad-Taha Ibrahim](https://www.pexels.com/@planeteelevene) | faith (portrait) |
| [11340666](https://www.pexels.com/photo/stacks-of-books-by-the-window-11340666/) | [Céline  |](https://www.pexels.com/@celine-3776818) | faith (interest) |
| [35719107](https://www.pexels.com/photo/vintage-film-cameras-on-retro-patterned-cloth-35719107/) | [Katerina Yu](https://www.pexels.com/@katerina-yu-1144885993) | faith (interest) |
| [40091323](https://www.pexels.com/photo/two-dogs-relaxing-on-green-grass-outdoors-40091323/) | [churiis S](https://www.pexels.com/@churiis-s-2163897593) | faith (interest) |
| [15929275](https://www.pexels.com/photo/close-up-of-young-smiling-man-15929275/) | [Victor Chijioke](https://www.pexels.com/@victor-chijioke-350220031) | sam (portrait) |
| [4242550](https://www.pexels.com/photo/trees-near-concrete-buildings-4242550/) | [jamies.x. co](https://www.pexels.com/@jamies-x-co) | sam (interest) |
| [20451088](https://www.pexels.com/photo/painting-drying-on-the-easel-20451088/) | [Zeynep Sude  Emek](https://www.pexels.com/@zeynep-sude-emek-193601188) | sam (interest) |
| [26898331](https://www.pexels.com/photo/view-of-a-city-26898331/) | [Kelvin Kibe](https://www.pexels.com/@kelvin-kibe-3073372) | sam (interest) |
| [27038743](https://www.pexels.com/photo/portrait-of-a-man-27038743/) | [Dokun  Ayano](https://www.pexels.com/@dokunayano) | wanjiku (portrait) |
| [11577808](https://www.pexels.com/photo/mountain-landscape-with-rocks-11577808/) | [Petra Nesti](https://www.pexels.com/@petra-nesti-1766376) | wanjiku (interest), streak (amani) |
| [4913342](https://www.pexels.com/photo/cup-of-aromatic-cappuccino-served-on-marble-table-4913342/) | [Maria Orlova](https://www.pexels.com/@orlovamaria) | chat image (brian) |
| [17295763](https://www.pexels.com/photo/acrylic-painting-17295763/) | [Kenny Ph](https://www.pexels.com/@kenny-ph-612238109) | streak (grace) |
| [30705679](https://www.pexels.com/photo/majestic-african-elephant-in-kenyan-grasslands-30705679/) | [Hugo Sykes](https://www.pexels.com/@hugosykes) | streak (daniel) |
