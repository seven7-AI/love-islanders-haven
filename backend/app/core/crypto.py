"""Encryption for stored third-party tokens and signing of OAuth state values."""

import base64
import hashlib
import hmac
import json
import time
import uuid

from cryptography.fernet import Fernet, InvalidToken


class TokenCipher:
    def __init__(self, key: str) -> None:
        self._fernet = Fernet(key.encode())

    def encrypt(self, value: str) -> str:
        return self._fernet.encrypt(value.encode()).decode()

    def decrypt(self, value: str) -> str:
        try:
            return self._fernet.decrypt(value.encode()).decode()
        except InvalidToken as exc:
            raise ValueError("Stored token cannot be decrypted with the current key") from exc


class InvalidState(Exception):
    pass


class StateSigner:
    """Short-lived, HMAC-signed OAuth state bound to the user who started the flow."""

    def __init__(self, secret: str, ttl_seconds: int = 600) -> None:
        self._key = hashlib.sha256(secret.encode()).digest()
        self._ttl = ttl_seconds

    def _sign(self, payload: bytes) -> str:
        return base64.urlsafe_b64encode(hmac.new(self._key, payload, hashlib.sha256).digest()).decode().rstrip("=")

    def issue(self, user_id: uuid.UUID, return_to: str) -> str:
        payload = json.dumps(
            {"u": str(user_id), "r": return_to, "e": int(time.time()) + self._ttl, "n": uuid.uuid4().hex}
        ).encode()
        body = base64.urlsafe_b64encode(payload).decode().rstrip("=")
        return f"{body}.{self._sign(payload)}"

    def verify(self, state: str, user_id: uuid.UUID) -> str:
        """Returns the return_to path if the state is authentic, unexpired and belongs to `user_id`."""
        try:
            body, signature = state.split(".")
            payload = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
        except ValueError as exc:
            raise InvalidState("Malformed state") from exc
        if not hmac.compare_digest(self._sign(payload), signature):
            raise InvalidState("Bad state signature")
        data = json.loads(payload)
        if data["e"] < time.time():
            raise InvalidState("State expired")
        if data["u"] != str(user_id):
            raise InvalidState("State belongs to another user")
        return str(data["r"])
