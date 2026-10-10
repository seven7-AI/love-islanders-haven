"""Deterministic seed personas for local and test environments.

Every persona is fictional. Photos are Pexels stock photos (https://www.pexels.com/license/), pinned by id and
credited in docs/development/seed-data.md; the first photo is a portrait, the others illustrate the persona's
interests. Emails use the reserved .test domain so they can never reach a real inbox.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

EMAIL_DOMAIN = "seed.loveislander.test"
State = Literal["signed_up", "photos_step", "onboarded"]

# Westlands, Kilimani, CBD and other Nairobi neighbourhoods; the API rounds stored coordinates to 2 decimals.
NAIROBI = (-1.2864, 36.8172)


@dataclass(frozen=True)
class Persona:
    key: str
    state: State
    name: str
    profile: dict[str, object] = field(default_factory=dict)
    photos: tuple[int, ...] = ()
    location: tuple[float, float] | None = None
    # Granted with the operator code (app.services.moderation), as `python -m app.admin roles grant` would.
    roles: tuple[str, ...] = ()

    @property
    def email(self) -> str:
        return f"{self.key}@{EMAIL_DOMAIN}"


def _p(
    name: str,
    dob: date,
    gender: str,
    preference: str,
    goal: str,
    bio: str,
    occupation: str,
    interests: list[str],
    *,
    height: int,
    education: str | None = None,
    **extra: object,
) -> dict[str, object]:
    return {
        "name": name,
        "dob": dob.isoformat(),
        "gender": gender,
        "gender_preference": preference,
        "relationship_goal": goal,
        "bio": bio,
        "occupation": occupation,
        "education": education,
        "interests": interests,
        "height_cm": height,
        "city": "Nairobi",
        "country": "Kenya",
        "age_range_min": 22,
        "age_range_max": 38,
        "distance_preference": 50,
        **extra,
    }


PERSONAS: tuple[Persona, ...] = (
    Persona(
        "amani",
        "onboarded",
        "Amani",
        _p(
            "Amani",
            date(1998, 3, 14),
            "female",
            "male",
            "long-term",
            "ICU nurse by day, sunrise hiker by weekend. Looking for someone who can keep up on Ngong Hills "
            "and still make a good cup of chai afterwards.",
            "Nurse",
            ["Hiking", "Coffee", "Reading", "Wildlife"],
            height=168,
            education="University of Nairobi",
            exercise="active",
            drinking_habit="socially",
            smoking_habit="never",
            love_language="time",
            pronouns="she/her",
        ),
        photos=(1804452, 27769600, 6747870, 33733117),
        location=(-1.2675, 36.8108),
    ),
    Persona(
        "brian",
        "onboarded",
        "Brian",
        _p(
            "Brian",
            date(1996, 7, 2),
            "male",
            "female",
            "long-term",
            "Software engineer who still plays Sunday league football. I'll find you the best coffee in town.",
            "Software Engineer",
            ["Football", "Coffee", "Cycling", "Tech"],
            height=180,
            education="Strathmore University",
            exercise="sometimes",
        ),
        photos=(7257963, 38275739, 31139336, 978613),
        location=(-1.2921, 36.7822),
    ),
    Persona(
        "daniel",
        "onboarded",
        "Daniel",
        _p(
            "Daniel",
            date(1997, 11, 20),
            "male",
            "female",
            "casual",
            "Wildlife photographer. Half my year is in the Mara, the other half editing photos in a café.",
            "Photographer",
            ["Photography", "Wildlife", "Beach", "Travel"],
            height=176,
        ),
        photos=(38165826, 36979007, 10800255, 28050045),
        location=(-1.2833, 36.8219),
    ),
    Persona(
        "kevin",
        "onboarded",
        "Kevin",
        _p(
            "Kevin",
            date(1995, 5, 9),
            "male",
            "female",
            "long-term",
            "Chef at a small Kilimani bistro. I play guitar badly and board games competitively.",
            "Chef",
            ["Cooking", "Music", "Board games"],
            height=183,
        ),
        photos=(12980901, 37261939, 10354611, 8111330),
        location=(-1.2905, 36.7871),
    ),
    Persona(
        "juma",
        "onboarded",
        "Juma",
        _p(
            "Juma",
            date(1999, 1, 27),
            "male",
            "female",
            "friendship",
            "Marathon trainee, pickup basketball regular, always has a playlist ready.",
            "Sports Science Student",
            ["Running", "Basketball", "Music"],
            height=187,
        ),
        photos=(16047707, 8454901, 35864991, 7558112),
        location=(-1.3032, 36.8073),
    ),
    Persona(
        "eric",
        "onboarded",
        "Eric",
        _p(
            "Eric",
            date(1993, 9, 3),
            "male",
            "both",
            "not-sure",
            "Banker. City views, good food and late-night basketball.",
            "Investment Analyst",
            ["Food", "Basketball", "City life"],
            height=178,
        ),
        photos=(5612323, 24390617, 4253293, 18680706),
        location=(-1.2841, 36.8155),
    ),
    Persona(
        "grace",
        "onboarded",
        "Grace",
        _p(
            "Grace",
            date(2000, 4, 18),
            "female",
            "male",
            "casual",
            "Painter and yoga teacher. My studio smells like turpentine and coffee.",
            "Artist",
            ["Art", "Yoga", "Coffee"],
            height=165,
        ),
        photos=(39598425, 6693728, 5928634, 27860686),
        location=(-1.2756, 36.8020),
    ),
    Persona(
        "lydia",
        "onboarded",
        "Lydia",
        _p(
            "Lydia",
            date(1996, 12, 6),
            "female",
            "male",
            "long-term",
            "High-school literature teacher, dog mum, happiest on a beach with a novel.",
            "Teacher",
            ["Reading", "Beach", "Dogs"],
            height=170,
        ),
        photos=(33646629, 18134314, 34752112, 34806418),
        location=(-1.2627, 36.8037),
    ),
    # Only what onboarding requires: no bio, job or location.
    Persona(
        "faith",
        "onboarded",
        "Faith",
        {
            "name": "Faith",
            "dob": date(1992, 8, 21).isoformat(),
            "gender": "female",
            "gender_preference": "male",
        },
        photos=(12672215, 11340666, 35719107, 40091323),
    ),
    # Onboarded but never shared a location.
    Persona(
        "sam",
        "onboarded",
        "Sam",
        _p(
            "Sam",
            date(1998, 2, 11),
            "male",
            "female",
            "long-term",
            "Architect sketching Nairobi one building at a time.",
            "Architect",
            ["Architecture", "Art", "City life"],
            height=181,
        ),
        photos=(15929275, 4242550, 20451088, 26898331),
    ),
    # Stopped at the photos step with 2 of the 4 required photos.
    Persona(
        "wanjiku",
        "photos_step",
        "Wanjiku",
        {
            "name": "Wanjiku",
            "dob": date(2001, 6, 30).isoformat(),
            "gender": "female",
            "gender_preference": "male",
        },
        photos=(27038743, 11577808),
    ),
    # Signed up and signed in once; nothing else.
    Persona("newcomer", "signed_up", "Newcomer"),
    # Staff account: reviews reports; has no dating profile and does not appear in Discover.
    Persona("mercy", "signed_up", "Mercy", {"name": "Mercy"}, roles=("moderator",)),
)

BY_KEY = {p.key: p for p in PERSONAS}

# Mutual likes (each pair becomes one match) and one-sided likes.
MATCHES: tuple[tuple[str, str], ...] = (("amani", "brian"), ("amani", "daniel"), ("grace", "kevin"))
ONE_SIDED_LIKES: tuple[tuple[str, str], ...] = (("kevin", "amani"), ("juma", "amani"), ("sam", "grace"))

# (match, [(sender, text), ...]); the last messages from the partner stay unread unless the pair is in READ_BY.
CONVERSATIONS: dict[tuple[str, str], tuple[tuple[str, str], ...]] = {
    ("amani", "brian"): (
        ("brian", "Hey Amani! Ngong Hills at sunrise sounds amazing. How early is early?"),
        ("amani", "5am start from Kilimani 😅 worth it for the view though"),
        ("brian", "Deal, if coffee is on me afterwards. Saturday?"),
        ("amani", "Saturday works. You're on coffee duty ☕"),
    ),
    ("amani", "daniel"): (
        ("daniel", "Your elephant photo looks like the Mara. Were you there recently?"),
        ("daniel", "I'm heading back next month for the migration, happy to share tips."),
    ),
    ("grace", "kevin"): (
        ("kevin", "A painter and a chef walk into a bistro…"),
        ("grace", "…and the chef cooks while the painter judges the plating 😄"),
        ("kevin", "Fair. Come by Friday and judge away."),
    ),
}
READ_BY: tuple[tuple[str, str], ...] = (("amani", "brian"),)
# (sender, match): an image message with this Pexels photo, sent after the conversation.
CHAT_IMAGES: tuple[tuple[str, tuple[str, str], int], ...] = (("brian", ("amani", "brian"), 4913342),)

# (author, Pexels photo id, caption)
STREAKS: tuple[tuple[str, int, str], ...] = (
    ("amani", 11577808, "Day 12 of sunrise hikes 🌄"),
    ("grace", 17295763, "New piece drying in the studio"),
    ("daniel", 30705679, "Breakfast guest at the Mara this morning"),
)
STREAK_LIKES: tuple[tuple[str, str], ...] = (("brian", "amani"), ("amani", "grace"), ("kevin", "grace"))

BLOCKS: tuple[tuple[str, str], ...] = (("amani", "eric"),)
# (reporter, reported, reason, details); the reporter also blocks the reported user.
REPORTS: tuple[tuple[str, str, str, str], ...] = (
    ("lydia", "eric", "harassment", "Kept sending messages after I asked him to stop."),
    ("grace", "juma", "spam", "Sent me the same investment link three times."),
)

SAFETY_CONTACTS: dict[str, tuple[dict[str, object], ...]] = {
    "amani": (
        {"name": "Mum (Esther)", "phone": "+254 712 000 001", "is_primary": True},
        {"name": "Njeri (best friend)", "email": "njeri@example.com"},
    ),
}
# (owner, plan); contact_name links the plan to one of the owner's contacts.
DATE_PLANS: tuple[tuple[str, dict[str, object], str | None], ...] = (
    (
        "amani",
        {
            "title": "Sunrise hike with Brian",
            "location": "Ngong Hills, Kona Baridi gate",
            "partner_name": "Brian",
            "notes": "Meeting at the gate, coffee afterwards in Karen.",
            "days_ahead": 3,
        },
        "Mum (Esther)",
    ),
)
FEEDBACK: tuple[tuple[str, str, str], ...] = (("amani", "feature", "Would love to see who liked my streak posts."),)
