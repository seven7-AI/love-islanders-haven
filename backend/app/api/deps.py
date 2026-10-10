from collections.abc import AsyncIterator
from typing import Annotated

import structlog
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import Database
from app.integrations.auth import AuthenticatedUser, AuthError, TokenVerifier
from app.services.moderation import MODERATOR, roles_of
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
    request: Request,
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
    # For log lines written by this request's handler and by the request-logging middleware.
    structlog.contextvars.bind_contextvars(user_id=str(user.id))
    request.state.user_id = str(user.id)
    await ensure_profile(session, user)
    return user


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


async def get_moderator(user: CurrentUser, session: SessionDep) -> AuthenticatedUser:
    if MODERATOR not in await roles_of(session, user.id):
        raise AppError(403, "Moderator access required", code="forbidden")
    return user


ModeratorUser = Annotated[AuthenticatedUser, Depends(get_moderator)]
