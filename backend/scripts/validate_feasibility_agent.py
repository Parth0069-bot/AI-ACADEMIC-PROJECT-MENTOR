#!/usr/bin/env python3
"""
Step 7 — Validation for Task 1's Feasibility Agent.

BEFORE RUNNING: start your backend server in another terminal:
    uvicorn app.main:app --reload

Usage:
    python scripts/validate_feasibility_agent.py <idea-id-1> <idea-id-2> ...
    Or, with no arguments, reads IDs from scripts/idea_ids.txt (one per line).
"""

import sys
import time
from pathlib import Path

import httpx

DEFAULT_BASE_URL = "http://127.0.0.1:8000"
IDEA_IDS_FILE = Path(__file__).parent / "idea_ids.txt"


def load_idea_ids() -> list[str]:
    if len(sys.argv) > 1:
        return sys.argv[1:]

    if IDEA_IDS_FILE.exists():
        lines = [line.strip() for line in IDEA_IDS_FILE.read_text().splitlines()]
        ids = [line for line in lines if line and not line.startswith("#")]
        if ids:
            return ids

    print(f"No idea IDs given, and no usable IDs found in {IDEA_IDS_FILE.name}.\n")
    print("Either pass idea IDs directly, or copy scripts/idea_ids.example.txt")
    print("to scripts/idea_ids.txt and paste in real IDs from your project_ideas table.")
    sys.exit(1)


def run_validation(base_url: str, idea_ids: list[str]) -> list[dict]:
    print(f"Validating Feasibility Agent against {len(idea_ids)} project idea(s)")
    print(f"Backend: {base_url}\n")

    results = []

    for idea_id in idea_ids:
        print(f"--- {idea_id} ---")
        start = time.time()

        try:
            response = httpx.post(f"{base_url}/agents/feasibility/{idea_id}", timeout=60)
        except httpx.ConnectError:
            print("  FAILED: could not connect to the backend.")
            print("  Is `uvicorn app.main:app --reload` running in another terminal?")
            results.append({"idea_id": idea_id, "ok": False, "error": "connection failed"})
            print()
            continue

        elapsed = time.time() - start

        if response.status_code == 200:
            body = response.json()
            result = body["result"]
            print(f"  Verdict:     {result['verdict']}  (confidence: {result['confidence_score']}/100)")
            print(f"  Reasoning:   {result['reasoning']}")
            if result["skill_gaps"]:
                print(f"  Skill gaps:  {', '.join(result['skill_gaps'])}")
            if result["suggested_adjustments"]:
                print(f"  Suggested:   {result['suggested_adjustments']}")
            print(f"  Saved to DB: {body['stored']}")
            print(f"  Took {elapsed:.1f}s")
            results.append({
                "idea_id": idea_id, "ok": True,
                "verdict": result["verdict"], "stored": body["stored"],
            })
        else:
            detail = response.text
            try:
                detail = response.json().get("detail", detail)
            except Exception:
                pass
            print(f"  FAILED: HTTP {response.status_code}")
            print(f"  {detail}")
            results.append({"idea_id": idea_id, "ok": False, "error": f"HTTP {response.status_code}: {detail}"})
        time.sleep(0.5)  # avoid overwhelming the backend with rapid-fire requests
        print()

    print("=" * 60)
    ok_count = sum(1 for r in results if r["ok"])
    stored_count = sum(1 for r in results if r.get("stored"))
    print(f"SUMMARY: {ok_count}/{len(results)} ideas processed successfully")
    print(f"         {stored_count}/{len(results)} results saved to the database")

    if ok_count < len(results):
        print("\nFailed:")
        for r in results:
            if not r["ok"]:
                print(f"  - {r['idea_id']}: {r['error']}")

    if ok_count > 0:
        print("\nNow eyeball the verdicts above:")
        print("  - Does a matched-skills student get 'Feasible'?")
        print("  - Does a mismatched one get real, specific skill_gaps?")
        print("  - Do confidence scores track how clear-cut each case is?")

    print("=" * 60)
    return results


if __name__ == "__main__":
    ids = load_idea_ids()
    run_validation(DEFAULT_BASE_URL, ids)
