#!/usr/bin/env python3
"""
Cross-platform helper (Windows / Linux / macOS) to push EduPage homework tasks
and test/exam calendar events to a Google Apps Script Web App endpoint.

Supports both:
- Single-student config:
  {"gtasks_webapp_url": "https://script.google.com/macros/s/.../exec"}
- Multi-student (parent) config:
  {
    "students": {
      "jakub": {"name": "Jakub Vacata", "class": "7.C", "student_id": -1202, "webapp_url": "https://..."},
      "marek": {"name": "Marek Vacata", "class": "5.A", "student_id": -1151, "webapp_url": "https://..."}
    }
  }
"""

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path


def load_config() -> dict:
    candidates = [
        Path.cwd() / "config.local.json",
        Path(__file__).resolve().parent.parent / "config.local.json",
        Path.home() / ".gemini" / "config" / "edupage-tasks.json",
    ]
    for path in candidates:
        if path.is_file():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                pass
    return {}


def resolve_webapp_url(cli_url: str | None, student_key: str | None) -> str:
    if cli_url:
        return cli_url.strip()

    cfg = load_config()

    if student_key:
        key_lower = student_key.strip().lower()
        students = cfg.get("students") or {}
        for k, v in students.items():
            if k.lower() == key_lower or str(v.get("name", "")).lower().startswith(key_lower) or str(v.get("class", "")).lower() == key_lower:
                url = str(v.get("webapp_url") or v.get("gtasks_webapp_url") or "").strip()
                if url:
                    return url

    env_url = os.environ.get("GTASKS_WEBAPP_URL", "").strip()
    if env_url:
        return env_url

    url = str(cfg.get("gtasks_webapp_url") or cfg.get("webapp_url") or "").strip()
    if url:
        return url

    raise SystemExit(
        "Error: Missing Google Apps Script Web App URL.\n"
        "Pass --url, --student <name>, set GTASKS_WEBAPP_URL, or configure config.local.json."
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Push EduPage homework (tasks) and tests/exams (events) to Google Apps Script Web App."
    )
    parser.add_argument("--url", help="Google Apps Script Web App URL (/exec)")
    parser.add_argument("--student", help="Student key/name from config.local.json (e.g. 'jakub' or 'marek')")
    parser.add_argument("--json", help='Inline JSON payload: \'{"tasks": [...], "events": [...]}\'')
    parser.add_argument("--file", help="Path to UTF-8 JSON file containing payload (use '-' for stdin)")
    parser.add_argument("--list", action="store_true", help="List current tasks from Google Tasks (GET)")
    args = parser.parse_args()

    url = resolve_webapp_url(args.url, args.student)

    if args.list:
        with urllib.request.urlopen(url, timeout=30) as resp:
            print(resp.read().decode("utf-8"))
        return 0

    if args.json:
        raw = args.json
    elif args.file:
        if args.file == "-":
            raw = sys.stdin.read()
        else:
            raw = Path(args.file).read_text(encoding="utf-8")
    else:
        raw = sys.stdin.read()

    parsed = json.loads(raw)
    if isinstance(parsed, list):
        payload = {"tasks": parsed, "events": []}
    elif isinstance(parsed, dict) and ("tasks" in parsed or "events" in parsed):
        payload = {
            "tasks": parsed.get("tasks", []),
            "events": parsed.get("events", []),
        }
    else:
        payload = {"tasks": [parsed], "events": []}

    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        print(body)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
