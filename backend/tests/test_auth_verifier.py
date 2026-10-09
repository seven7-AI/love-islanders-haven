import base64
import json
import time
import uuid
from collections.abc import Iterator

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.integrations.auth import AuthError, SupabaseTokenVerifier
from tests.auth_helpers import HS_SECRET, es256_token, hs256_token, jwks_server


@pytest.fixture(scope="module")
def supabase_url() -> Iterator[str]:
    with jwks_server() as url:
        yield url


@pytest.fixture
def jwks_verifier(supabase_url: str) -> SupabaseTokenVerifier:
    return SupabaseTokenVerifier(supabase_url=supabase_url, jwt_secret=None)


@pytest.fixture
def hs_verifier() -> SupabaseTokenVerifier:
    return SupabaseTokenVerifier(supabase_url=None, jwt_secret=HS_SECRET)


def test_accepts_es256_token_from_jwks(jwks_verifier: SupabaseTokenVerifier, supabase_url: str) -> None:
    sub = uuid.uuid4()
    user = jwks_verifier.verify(es256_token(f"{supabase_url}/auth/v1", sub=sub))
    assert user.id == sub
    assert user.email == "ava@example.com"
    assert user.name == "Ava"


def test_accepts_legacy_hs256_token(hs_verifier: SupabaseTokenVerifier) -> None:
    sub = uuid.uuid4()
    assert hs_verifier.verify(hs256_token(sub=sub)).id == sub


def test_rejects_expired_token(hs_verifier: SupabaseTokenVerifier) -> None:
    with pytest.raises(AuthError, match="expired"):
        hs_verifier.verify(hs256_token(exp=int(time.time()) - 3600))


def test_rejects_wrong_audience(hs_verifier: SupabaseTokenVerifier) -> None:
    with pytest.raises(AuthError):
        hs_verifier.verify(hs256_token(aud="something-else"))


def test_rejects_anon_role(hs_verifier: SupabaseTokenVerifier) -> None:
    with pytest.raises(AuthError, match="signed-in"):
        hs_verifier.verify(hs256_token(role="anon"))


def test_rejects_token_signed_with_other_secret(hs_verifier: SupabaseTokenVerifier) -> None:
    forged = jwt.encode(
        {"sub": str(uuid.uuid4()), "aud": "authenticated", "role": "authenticated", "exp": int(time.time()) + 60},
        "another-secret-of-sufficient-length!!",
        algorithm="HS256",
    )
    with pytest.raises(AuthError, match="Invalid"):
        hs_verifier.verify(forged)


def test_rejects_unsigned_token(hs_verifier: SupabaseTokenVerifier) -> None:
    def b64(data: dict[str, object]) -> str:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()

    payload = {"sub": str(uuid.uuid4()), "aud": "authenticated", "role": "authenticated", "exp": int(time.time()) + 60}
    unsigned = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64(payload)}."
    with pytest.raises(AuthError, match="algorithm"):
        hs_verifier.verify(unsigned)


def test_rejects_hs256_when_only_jwks_is_configured(jwks_verifier: SupabaseTokenVerifier) -> None:
    # Algorithm confusion: an HS256 token must not be accepted by a verifier configured for asymmetric keys.
    with pytest.raises(AuthError, match="algorithm"):
        jwks_verifier.verify(hs256_token())


def test_rejects_wrong_issuer(jwks_verifier: SupabaseTokenVerifier) -> None:
    with pytest.raises(AuthError):
        jwks_verifier.verify(es256_token("https://evil.example.com/auth/v1"))


def test_rejects_key_not_in_jwks(jwks_verifier: SupabaseTokenVerifier, supabase_url: str) -> None:
    other_key = ec.generate_private_key(ec.SECP256R1())
    with pytest.raises(AuthError):
        jwks_verifier.verify(es256_token(f"{supabase_url}/auth/v1", key=other_key, kid="unknown"))


def test_rejects_same_kid_with_different_key(jwks_verifier: SupabaseTokenVerifier, supabase_url: str) -> None:
    other_key = ec.generate_private_key(ec.SECP256R1())
    with pytest.raises(AuthError, match="Invalid"):
        jwks_verifier.verify(es256_token(f"{supabase_url}/auth/v1", key=other_key))


def test_rejects_garbage(hs_verifier: SupabaseTokenVerifier) -> None:
    with pytest.raises(AuthError, match="Malformed"):
        hs_verifier.verify("not-a-jwt")


def test_requires_some_key_configuration() -> None:
    with pytest.raises(ValueError):
        SupabaseTokenVerifier(supabase_url=None, jwt_secret=None)
