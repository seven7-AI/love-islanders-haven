from pathlib import Path

from app.openapi_export import render

SPEC = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.json"


def test_committed_openapi_document_is_current() -> None:
    assert SPEC.exists(), "docs/api/openapi.json is missing; run `make api-docs`"
    assert SPEC.read_text(encoding="utf-8") == render(), "docs/api/openapi.json is out of date; run `make api-docs`"
