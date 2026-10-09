"""Verification of access tokens issued by the auth provider (Supabase Auth).

The API never trusts a user id from a request body or query: identity comes only from a verified token.
"""

import uuid
from dataclasses import dataclass
from typing import Any, Protocol

import jwt
from jwt import PyJWKClient

ASYMMETRIC_ALGORITHMS = ["ES256", "RS256", "EdDSA"]


class AuthError(Exception):
    """The request is not authenticated (missing, malformed, expired or untrusted token)."""


@dataclass(frozen=True)
class AuthenticatedUser:
    id: uuid.UUID
    email: str | None
    role: str
    name: str | None = None


class TokenVerifier(Protocol):
    def verify(self, token: str) -> AuthenticatedUser: ...


class SupabaseTokenVerifier:
    """Verifies Supabase Auth access tokens.

    With `supabase_url`, signing keys come from `<url>/auth/v1/.well-known/jwks.json` (cached by PyJWKClient).
    With `jwt_secret`, HS256 tokens signed with the project's legacy secret are accepted. Both can be configured
    during a key rotation.
    """

    def __init__(
        self,
        *,
        supabase_url: str | None,
        jwt_secret: str | None,
        audience: str = "authenticated",
        jwks_client: PyJWKClient | None = None,
    ) -> None:
        if not supabase_url and not jwt_secret:
            raise ValueError("supabase_url or jwt_secret is required")
        self._secret = jwt_secret
        self._audience = audience
        self._issuer = f"{supabase_url.rstrip('/')}/auth/v1" if supabase_url else None
        self._jwks = jwks_client or (
            PyJWKClient(f"{self._issuer}/.well-known/jwks.json", cache_keys=True, lifespan=600, timeout=5)
            if self._issuer
            else None
        )

    def verify(self, token: str) -> AuthenticatedUser:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise AuthError("Malformed token") from exc

        alg = header.get("alg")
        key: Any
        if alg == "HS256":
            if not self._secret:
                raise AuthError("Token algorithm not accepted")
            key, algorithms = self._secret, ["HS256"]
        elif alg in ASYMMETRIC_ALGORITHMS and self._jwks is not None:
            try:
                key = self._jwks.get_signing_key_from_jwt(token).key
            except jwt.PyJWKClientError as exc:
                raise AuthError("Unknown signing key") from exc
            algorithms = [alg]
        else:
            raise AuthError("Token algorithm not accepted")

        options = {"require": ["exp", "sub", "aud"], "verify_iss": self._issuer is not None}
        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                key=key,
                algorithms=algorithms,
                audience=self._audience,
                issuer=self._issuer,
                options=options,  # type: ignore[arg-type]
                leeway=30,
            )
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("Token expired") from exc
        except jwt.PyJWTError as exc:
            raise AuthError("Invalid token") from exc

        if claims.get("role") != "authenticated":
            raise AuthError("Token is not for a signed-in user")
        try:
            user_id = uuid.UUID(str(claims["sub"]))
        except ValueError as exc:
            raise AuthError("Invalid subject") from exc

        metadata = claims.get("user_metadata") or {}
        name = metadata.get("name") if isinstance(metadata, dict) else None
        return AuthenticatedUser(id=user_id, email=claims.get("email"), role=claims["role"], name=name)
