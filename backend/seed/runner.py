"""Creates, verifies and removes the seed data through Supabase Auth and the Love Islander API."""

from collections.abc import Callable
from datetime import UTC, datetime, time, timedelta
from typing import Any

import asyncpg

from seed import personas as P
from seed.photos import PhotoSource
from seed.stack import SeedError, Session, Stack

Log = Callable[[str], None]


class Seeder:
    def __init__(self, stack: Stack, photos: PhotoSource, password: str, log: Log = print) -> None:
        self.stack = stack
        self.photos = photos
        self.password = password
        self.log = log
        self.sessions: dict[str, Session] = {}

    async def _as(self, key: str) -> Session:
        if key not in self.sessions:
            persona = P.BY_KEY[key]
            await self.stack.ensure_auth_user(persona.email, self.password, persona.name)
            self.sessions[key] = await self.stack.sign_in(persona.email, self.password)
        return self.sessions[key]

    async def call(self, key: str, method: str, path: str, body: Any = None, **kwargs: Any) -> Any:
        return await self.stack.api(await self._as(key), method, path, body, **kwargs)

    # Accounts and profiles ----------------------------------------------------------------------------------------

    async def run(self) -> None:
        for persona in P.PERSONAS:
            await self._persona(persona)
        await self._relationships()
        self.log("seed complete")

    async def _persona(self, persona: P.Persona) -> None:
        await self.call(persona.key, "GET", "/v1/me")  # creates the profile, as the first sign-in does in the app
        if persona.state == "signed_up":
            self.log(f"{persona.key}: signed up")
            return
        await self.call(persona.key, "PATCH", "/v1/me/profile", persona.profile)
        await self._photos(persona)
        await self.call(
            persona.key, "PUT", "/v1/me/onboarding", {"step": "completed" if persona.state == "onboarded" else "photos"}
        )
        if persona.location:
            latitude, longitude = persona.location
            await self.call(persona.key, "PUT", "/v1/me/location", {"latitude": latitude, "longitude": longitude})
        self.log(f"{persona.key}: {persona.state}, {len(persona.photos)} photos")

    async def _photos(self, persona: P.Persona) -> None:
        profile = await self.call(persona.key, "GET", "/v1/me/profile")
        for photo_id in persona.photos[len(profile["images"]) :]:
            data, content_type = await self.photos.get(photo_id, "portrait")
            session = await self._as(persona.key)
            path = await self.stack.upload(
                session,
                "/v1/me/images/uploads",
                {"content_type": content_type, "size_bytes": len(data)},
                data,
                content_type,
            )
            await self.call(persona.key, "POST", "/v1/me/images", {"path": path})

    # Relationships ------------------------------------------------------------------------------------------------

    async def _user_id(self, key: str) -> str:
        return (await self._as(key)).user_id

    async def _match_id(self, a: str, b: str) -> str:
        partner = await self._user_id(b)
        page = await self.call(a, "GET", "/v1/matches?limit=50")
        for match in page["matches"]:
            if match["partner"]["id"] == partner:
                return str(match["id"])
        raise SeedError(f"no match between {a} and {b}")

    async def _swipe(self, a: str, b: str) -> None:
        await self.call(
            a, "POST", "/v1/swipes", {"target_id": await self._user_id(b), "direction": "right"}, ok=(200, 201, 409)
        )

    async def _relationships(self) -> None:
        for a, b in P.MATCHES:
            await self._swipe(a, b)
            await self._swipe(b, a)
        for a, b in P.ONE_SIDED_LIKES:
            await self._swipe(a, b)

        for pair, lines in P.CONVERSATIONS.items():
            match_id = await self._match_id(*pair)
            existing = await self.call(pair[0], "GET", f"/v1/matches/{match_id}/messages?limit=100")
            if not existing["messages"]:
                for sender, text in lines:
                    await self.call(sender, "POST", f"/v1/matches/{match_id}/messages", {"content": text})
            for reader in P.READ_BY:
                if reader == pair:
                    await self.call(pair[0], "POST", f"/v1/matches/{match_id}/read")

        for sender, pair, photo_id in P.CHAT_IMAGES:
            match_id = await self._match_id(*pair)
            messages = (await self.call(sender, "GET", f"/v1/matches/{match_id}/messages?limit=100"))["messages"]
            if any(m["content_type"] == "image" for m in messages):
                continue
            data, content_type = await self.photos.get(photo_id, "large")
            path = await self.stack.upload(
                await self._as(sender),
                f"/v1/matches/{match_id}/media/uploads",
                {"content_type": content_type, "size_bytes": len(data)},
                data,
                content_type,
            )
            await self.call(
                sender,
                "POST",
                f"/v1/matches/{match_id}/messages",
                {"content": "The view from that café I mentioned", "content_type": "image", "media_path": path},
            )

        for author, photo_id, caption in P.STREAKS:
            if (await self.call(author, "GET", "/v1/streaks/me"))["has_posted_today"]:
                continue
            data, content_type = await self.photos.get(photo_id, "large")
            path = await self.stack.upload(
                await self._as(author),
                "/v1/streaks/uploads",
                {"content_type": content_type, "size_bytes": len(data)},
                data,
                content_type,
            )
            await self.call(
                author, "POST", "/v1/streaks", {"media_paths": [path], "caption": caption, "duration_hours": 72}
            )
        for liker, author in P.STREAK_LIKES:
            author_id = await self._user_id(author)
            feed = await self.call(liker, "GET", "/v1/streaks?limit=50")
            for post in feed["posts"]:
                if post["user_id"] == author_id:
                    await self.call(liker, "PUT", f"/v1/streaks/{post['id']}/like")
                    break

        for blocker, blocked in P.BLOCKS:
            await self.call(
                blocker, "POST", "/v1/blocks", {"user_id": await self._user_id(blocked)}, ok=(200, 201, 409)
            )
        for reporter, reported, reason, details in P.REPORTS:
            reported_id = await self._user_id(reported)
            blocked = await self.call(reporter, "GET", "/v1/blocks")
            if any(b["user_id"] == reported_id for b in blocked):
                continue  # reported before (a report also blocks)
            await self.call(
                reporter,
                "POST",
                "/v1/reports",
                {"user_id": reported_id, "reason": reason, "details": details, "also_block": True},
            )

        for owner, contacts in P.SAFETY_CONTACTS.items():
            existing_names = {c["name"] for c in await self.call(owner, "GET", "/v1/safety-contacts")}
            for contact in contacts:
                if contact["name"] not in existing_names:
                    await self.call(owner, "POST", "/v1/safety-contacts", contact)
        for owner, plan, contact_name in P.DATE_PLANS:
            plans = await self.call(owner, "GET", "/v1/date-plans")
            if any(p["title"] == plan["title"] for p in plans):
                continue
            contacts = await self.call(owner, "GET", "/v1/safety-contacts")
            contact_id = next((c["id"] for c in contacts if c["name"] == contact_name), None)
            day = datetime.now(UTC).date() + timedelta(days=int(str(plan["days_ahead"])))
            body = {k: v for k, v in plan.items() if k != "days_ahead"}
            body["date_time"] = datetime.combine(day, time(3, 30), tzinfo=UTC).isoformat()  # 06:30 in Nairobi
            body["contact_id"] = contact_id
            await self.call(owner, "POST", "/v1/date-plans", body)
        for owner, category, content in P.FEEDBACK:
            if not await self.call(owner, "GET", "/v1/feedback"):
                await self.call(owner, "POST", "/v1/feedback", {"category": category, "content": content})

    # Verification -------------------------------------------------------------------------------------------------

    async def verify(self) -> list[str]:
        """Checks the seeded state through the API; returns the problems found (empty when everything matches)."""
        problems: list[str] = []

        def expect(condition: bool, message: str) -> None:
            if not condition:
                problems.append(message)

        for persona in P.PERSONAS:
            me = await self.call(persona.key, "GET", "/v1/me/profile")
            if persona.state == "signed_up":
                expect(not me["onboarding_completed"], f"{persona.key}: should not be onboarded")
                continue
            expect(len(me["images"]) == len(persona.photos), f"{persona.key}: {len(me['images'])} photos")
            if persona.state == "onboarded":
                expect(me["onboarding_completed"], f"{persona.key}: not onboarded")
            else:
                expect(not me["onboarding_completed"] and me["onboarding_step"] == "photos", f"{persona.key}: step")

        for a, b in P.MATCHES:
            await self._match_id(a, b)  # raises when missing
        amani = await self.call("amani", "GET", "/v1/matches?limit=50")
        daniel_id = await self._user_id("daniel")
        unread = {m["partner"]["id"]: m["unread_count"] for m in amani["matches"]}
        expect(unread.get(daniel_id, 0) >= 1, "amani: no unread messages from daniel")
        expect(len(await self.call("amani", "GET", "/v1/safety-contacts")) >= 2, "amani: safety contacts")
        expect(len(await self.call("amani", "GET", "/v1/date-plans")) >= 1, "amani: date plans")
        eric_id = await self._user_id("eric")
        expect(any(b["user_id"] == eric_id for b in await self.call("amani", "GET", "/v1/blocks")), "amani: block")
        expect(any(b["user_id"] == eric_id for b in await self.call("lydia", "GET", "/v1/blocks")), "lydia: report")
        board = await self.call("amani", "GET", "/v1/streaks/leaderboard?limit=10")
        expect(len(board) >= 1, "leaderboard is empty")
        return problems


async def reset(stack: Stack, database_url: str, log: Log = print) -> int:
    """Deletes every seed account (matched only by the seed email domain), its data and its files."""
    users = [u for u in await stack.auth_users() if str(u.get("email", "")).endswith(f"@{P.EMAIL_DOMAIN}")]
    ids = [str(u["id"]) for u in users]
    if not ids:
        log("no seed accounts found")
        return 0
    conn = await asyncpg.connect(database_url.replace("postgresql+asyncpg://", "postgresql://"))
    try:
        match_ids = [
            str(r["id"])
            for r in await conn.fetch(
                "SELECT id FROM matches WHERE user_id = ANY($1::uuid[]) OR matched_user_id = ANY($1::uuid[])", ids
            )
        ]
        for bucket, prefixes in (("profile-images", ids), ("chat-media", match_ids)):
            for prefix in prefixes:
                await stack.delete_objects(bucket, await stack.list_objects(bucket, prefix))
        # Every user-owned row references profiles with ON DELETE CASCADE.
        deleted = await conn.execute("DELETE FROM profiles WHERE id = ANY($1::uuid[])", ids)
    finally:
        await conn.close()
    for user_id in ids:
        await stack.delete_auth_user(user_id)
    log(f"removed {len(ids)} seed accounts ({deleted.split()[-1]} profiles), their files and their data")
    return len(ids)
