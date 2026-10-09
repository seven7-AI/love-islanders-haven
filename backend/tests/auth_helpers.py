"""Test substitutes for Supabase Auth: locally generated signing keys and a local JWKS endpoint.

These verify the API's token handling; they are not a test of Supabase Auth itself.
"""

import json
import threading
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from jwt.algorithms import ECAlgorithm

HS_SECRET = "test-secret-with-at-least-32-characters!!"
EC_KEY = ec.generate_private_key(ec.SECP256R1())
EC_KID = "test-key-1"


def claims(sub: uuid.UUID | str | None = None, **overrides: Any) -> dict[str, Any]:
    now = int(time.time())
    base: dict[str, Any] = {
        "sub": str(sub or uuid.uuid4()),
        "aud": "authenticated",
        "role": "authenticated",
        "email": "ava@example.com",
        "iat": now,
        "exp": now + 3600,
        "user_metadata": {"name": "Ava"},
    }
    base.update(overrides)
    return {k: v for k, v in base.items() if v is not None}


def hs256_token(**overrides: Any) -> str:
    return jwt.encode(claims(**overrides), HS_SECRET, algorithm="HS256")


def es256_token(issuer: str, key: ec.EllipticCurvePrivateKey = EC_KEY, kid: str = EC_KID, **overrides: Any) -> str:
    return jwt.encode(claims(iss=issuer, **overrides), key, algorithm="ES256", headers={"kid": kid})


def jwks() -> dict[str, Any]:
    jwk = json.loads(ECAlgorithm.to_jwk(EC_KEY.public_key()))
    jwk.update({"kid": EC_KID, "alg": "ES256", "use": "sig"})
    return {"keys": [jwk]}


@contextmanager
def jwks_server() -> Iterator[str]:
    """Serves the test JWKS at <base>/auth/v1/.well-known/jwks.json; yields <base> (a stand-in SUPABASE_URL)."""
    body = json.dumps(jwks()).encode()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path == "/auth/v1/.well-known/jwks.json":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, *args: object) -> None:
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
