#!/usr/bin/env python3
"""Fails if documentation points at files that do not exist.

Checks every Markdown file outside docs/audit/ (a dated historical record), node_modules and virtualenvs:
- relative links `[text](path)` resolve from the file's directory (anchors are ignored);
- backticked repository paths such as `scripts/db/backup.sh` or `web/src/lib/api/` exist. A token counts as a
  repository path when it starts with a top-level directory of this repository; tokens with wildcards, placeholders
  (`<...>`, `…`) or spaces are skipped.

Not checked: fenced code blocks, sections whose heading ends in "(history)", git-ignored paths (local files and
generated output), and the documented exceptions in KNOWN_MISSING.

Usage: scripts/check-doc-references.py   (from anywhere; exits 1 and lists the broken references)
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOP_LEVEL = ("web/", "backend/", "e2e/", "supabase/", "deploy/", "scripts/", "docs/", ".github/")
SKIP_DIRS = {"node_modules", ".venv", ".git", "audit", ".codegraph", ".security", "playwright-report", "test-results"}
# Paths the docs mention on purpose although they do not exist in the repository.
KNOWN_MISSING = {
    "supabase/migration.sql": "deleted stale file, described in the schema reconciliation",
    "web/public/app-icon.png": "app icon not yet added; the mobile docs say so",
}
FENCE = re.compile(r"^```.*?^```", re.M | re.S)
HISTORY = re.compile(r"^(#+) .*\(history\)\s*$.*?(?=^#{1,6} |\Z)", re.M | re.S)
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
CODE = re.compile(r"`([^`\n]+)`")


def markdown_files() -> list[Path]:
    return sorted(
        p
        for p in ROOT.rglob("*.md")
        if not SKIP_DIRS.intersection(p.relative_to(ROOT).parts) and p.name != "CLAUDE.local.md"
    )


def ignored_by_git(rel: str) -> bool:
    return subprocess.run(["git", "-C", str(ROOT), "check-ignore", "-q", rel], check=False).returncode == 0


def broken_references(path: Path) -> list[str]:
    problems = []
    text = HISTORY.sub("", FENCE.sub("", path.read_text(encoding="utf-8")))
    for target in LINK.findall(text):
        if re.match(r"^[a-z]+:", target) or target.startswith("#"):
            continue
        file_part = target.split("#", 1)[0]
        if file_part and not (path.parent / file_part).exists():
            problems.append(f"link {target}")
    for token in CODE.findall(text):
        token = token.strip()
        if not token.startswith(TOP_LEVEL) or any(c in token for c in "*<>… ${}"):
            continue
        token = token.split(":", 1)[0].split("#", 1)[0]  # `file.py:12`, `file.py::test_name`
        if not (ROOT / token).exists() and token not in KNOWN_MISSING and not ignored_by_git(token):
            problems.append(f"path `{token}`")
    return problems


def main() -> int:
    failures = 0
    files = markdown_files()
    for path in files:
        for problem in broken_references(path):
            print(f"{path.relative_to(ROOT)}: {problem}")
            failures += 1
    print(f"{len(files)} Markdown files checked, {failures} broken references")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
