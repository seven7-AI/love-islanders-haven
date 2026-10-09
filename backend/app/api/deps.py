from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import Database
from app.integrations.auth import AuthenticatedUser, AuthError, TokenVerifier
from app.services.users import ensure_profile

_bearer = HTTPBearer(auto_error=False)


def get_database(request: Request) -> Database:
    db: Database = request.app.state.db
    return db


async def get_session(db: Annotated[Database, Depends(get_database)]) -> AsyncIterator[AsyncSession]:
    async for session in db.session():
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_token_verifier(request: Request) -> TokenVerifier:
    verifier: TokenVerifier = request.app.state.token_verifier
    return verifier


class Unauthorized(AppError):
    def __init__(self, detail: str) -> None:
        super().__init__(401, detail, code="unauthorized")


async def get_current_user(
    session: SessionDep,
    verifier: Annotated[TokenVerifier, Depends(get_token_verifier)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise Unauthorized("Authentication required")
    try:
        user = verifier.verify(credentials.credentials)
    except AuthError as exc:
        raise Unauthorized(str(exc)) from exc
    await ensure_profile(session, user)
    return user


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
