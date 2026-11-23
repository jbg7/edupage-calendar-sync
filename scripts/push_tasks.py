#!/usr/bin/env python3
"""
Cross-platform helper (Windows / Linux / macOS) to push EduPage homework tasks
to the user's Google Apps Script Web App endpoint (Google Tasks).
Uses only the Python standard library (urllib, json, os, sys, pathlib).
"""

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path


def load_webapp_url(cli_url: str | None) -> str:
    if cli_url:
        return cli_url.strip()
    env_url = os.environ.get("GTASKS_WEBAPP_URL", "").strip()
    if env_url:
        return env_url

    candidates = [
        Path.cwd() / "config.local.json",
        Path(__file__).resolve().parent.parent / "config.local.json",
        Path.home() / ".gemini" / "config" / "edupage-tasks.json",
    ]
    for path in candidates:
        if path.is_file():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                url = str(data.get("gtasks_webapp_url", "")).strip()
                if url:
                    return url
            except Exception:
                pass

    raise SystemExit(
        "Error: Missing Google Apps Script Web App URL.\n"
        "Set GTASKS_WEBAPP_URL environment variable, pass --url, or save "
        '{"gtasks_webapp_url": "https://script.google.com/macros/s/.../exec"} '
        "in config.local.json or ~/.gemini/config/edupage-tasks.json."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Push EduPage homework tasks to Google Tasks via Apps Script Web App.")
    parser.add_argument("--url", help="Google Apps Script Web App URL (/exec)")
    parser.add_argument("--json", help="Inline JSON payload: '{\"tasks\": [...]}' or '[...]'")
    parser.add_argument("--file", help="Path to JSON file containing tasks payload (use '-' for stdin)")
    parser.add_argument("--list", action="store_true", help="List current tasks from Google Tasks (GET)")
    args = parser.parse_args()

    url = load_webapp_url(args.url)

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
        payload = {"tasks": parsed}
    elif isinstance(parsed, dict) and "tasks" in parsed:
        payload = parsed
    else:
        payload = {"tasks": [parsed]}

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
