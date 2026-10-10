"""Operator commands. Roles can only be changed here, by someone with the API's environment; never through the API.

    python -m app.admin roles grant  (--email EMAIL | --user-id UUID) [--role moderator] [--by NAME]
    python -m app.admin roles revoke (--email EMAIL | --user-id UUID) [--role moderator]
    python -m app.admin roles list

`--email` looks the user up through the Supabase Auth admin API (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).
The user must have signed in to the app once, so that their profile exists.
"""

import argparse
import asyncio
import getpass
import sys
import uuid

import httpx

from app.core.config import Settings, get_settings
from app.db.session import Database, create_engine
from app.services import moderation
from app.services.profiles import NotFound

ROLES = ("moderator",)


class AdminError(Exception):
    pass


async def user_id_for_email(settings: Settings, email: str, client: httpx.AsyncClient | None = None) -> uuid.UUID:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise AdminError("--email needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; use --user-id instead")
    key = settings.supabase_service_role_key
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    wanted = email.strip().lower()
    async with client or httpx.AsyncClient(timeout=10) as http:
        page = 1
        while True:
            response = await http.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users",
                params={"page": page, "per_page": 200},
                headers=headers,
            )
            if response.status_code != 200:
                raise AdminError(f"Supabase Auth admin API answered {response.status_code}")
            users = response.json().get("users", [])
            for user in users:
                if str(user.get("email", "")).lower() == wanted:
                    return uuid.UUID(user["id"])
            if len(users) < 200:
                raise AdminError(f"No user with email {email}")
            page += 1


async def run(args: argparse.Namespace, settings: Settings) -> str:
    db = Database(create_engine(settings))
    try:
        async with db.sessionmaker() as session:
            if args.action == "list":
                rows = await moderation.list_roles(session)
                if not rows:
                    return "No roles granted."
                return "\n".join(
                    f"{r.user_id}  {r.role}  {r.name or '-'}  granted {r.granted_at:%Y-%m-%d} by {r.granted_by or '-'}"
                    for r in rows
                )
            user_id = args.user_id or await user_id_for_email(settings, args.email)
            if args.action == "grant":
                try:
                    granted = await moderation.grant_role(session, user_id, args.role, args.by)
                except NotFound as exc:
                    raise AdminError(f"User {user_id} has no profile yet; they must sign in to the app once") from exc
                return f"Granted {args.role} to {user_id}" if granted else f"{user_id} already has {args.role}"
            revoked = await moderation.revoke_role(session, user_id, args.role)
            return f"Revoked {args.role} from {user_id}" if revoked else f"{user_id} did not have {args.role}"
    finally:
        await db.dispose()


def parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m app.admin", description="Operator commands.")
    commands = parser.add_subparsers(dest="command", required=True)
    roles = commands.add_parser("roles", help="grant, revoke or list roles")
    actions = roles.add_subparsers(dest="action", required=True)
    for name in ("grant", "revoke"):
        action = actions.add_parser(name)
        who = action.add_mutually_exclusive_group(required=True)
        who.add_argument("--email")
        who.add_argument("--user-id", type=uuid.UUID)
        action.add_argument("--role", choices=ROLES, default="moderator")
        if name == "grant":
            action.add_argument("--by", default=getpass.getuser(), help="who is granting (recorded); default: you")
    actions.add_parser("list")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse(sys.argv[1:] if argv is None else argv)
    try:
        print(asyncio.run(run(args, get_settings())))
    except AdminError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
