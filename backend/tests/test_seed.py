"""The seed definitions obey the API's rules, and the seed refuses production or remote targets.

Running the seed against a real stack is covered by `SEED=1 scripts/e2e.sh` (run, re-run, verify, then the E2E suite).
"""

import asyncio
from datetime import date
from pathlib import Path

import pytest

from app.schemas.profile import ProfileUpdate
from seed import personas as P
from seed.__main__ import SeedSettings, refuse_unsafe


def settings(**values: str) -> SeedSettings:
    return SeedSettings(_env_file=None, **values)  # type: ignore[arg-type]


def test_refuses_production_and_remote_targets() -> None:
    assert refuse_unsafe(settings(), allow_remote=False) is None
    assert "production" in (refuse_unsafe(settings(environment="production"), allow_remote=True) or "")
    remote = settings(supabase_url="https://abc.supabase.co")
    assert "not a local stack" in (refuse_unsafe(remote, allow_remote=False) or "")
    assert refuse_unsafe(remote, allow_remote=True) is None
    assert refuse_unsafe(settings(api_url="https://api.example.com"), allow_remote=False)


def test_personas_have_unique_keys_and_reserved_emails() -> None:
    keys = [p.key for p in P.PERSONAS]
    assert len(keys) == len(set(keys))
    assert all(p.email.endswith("@seed.loveislander.test") for p in P.PERSONAS)


@pytest.mark.parametrize("persona", [p for p in P.PERSONAS if p.state != "signed_up"], ids=lambda p: p.key)
def test_profiles_pass_api_validation(persona: P.Persona) -> None:
    ProfileUpdate.model_validate(persona.profile)
    dob = date.fromisoformat(str(persona.profile["dob"]))
    assert (date(2026, 1, 1) - dob).days // 365 >= 18
    for field in ("name", "dob", "gender", "gender_preference"):  # required to finish onboarding
        assert persona.profile.get(field)
    if persona.state == "onboarded":
        assert 4 <= len(persona.photos) <= 6
    else:
        assert len(persona.photos) < 4


def test_relationships_reference_onboarded_personas() -> None:
    onboarded = {p.key for p in P.PERSONAS if p.state == "onboarded"}
    pairs = [*P.MATCHES, *P.ONE_SIDED_LIKES, *P.STREAK_LIKES, *P.BLOCKS, *[(r[0], r[1]) for r in P.REPORTS]]
    assert all(a in onboarded and b in onboarded and a != b for a, b in pairs)
    for pair, lines in P.CONVERSATIONS.items():
        assert pair in P.MATCHES
        assert all(sender in pair for sender, _ in lines)
    assert all(a in onboarded for a, _, _ in P.STREAKS)


def test_moderator_persona_can_review_every_seeded_report() -> None:
    staff = [p for p in P.PERSONAS if p.roles]
    assert [(p.key, p.roles) for p in staff] == [("mercy", ("moderator",))]
    involved = {key for reporter, reported, _, _ in P.REPORTS for key in (reporter, reported)}
    assert not involved & {p.key for p in staff}  # moderators cannot review reports that involve them
    assert involved <= set(P.BY_KEY)


async def test_placeholder_photos_only_when_asked(tmp_path: Path) -> None:
    from app.services.uploads import sniff
    from seed.photos import PhotoSource

    strict = PhotoSource(None, tmp_path)
    with pytest.raises(RuntimeError, match="SEED_PLACEHOLDER_PHOTOS"):
        await strict.get(123, "portrait")

    lenient = PhotoSource(None, tmp_path, placeholders=True)
    data, content_type = await lenient.get(123, "portrait")
    assert content_type == "image/png" and sniff(data[:16]) == "image/png"
    assert lenient.placeholders_used == 1
    assert not any(await asyncio.to_thread(lambda: list(tmp_path.iterdir())))  # never cached as Pexels photos
