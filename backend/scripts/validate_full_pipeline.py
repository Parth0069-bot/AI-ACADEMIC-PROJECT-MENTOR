#!/usr/bin/env python3
"""
Task 6 — Full pipeline validation: Feasibility -> Scope -> Technology -> Timeline.

Runs all 4 agents in order against real project ideas from your database, via
a running backend, and checks that each stage actually consumed the previous
stage's result (not just that it returned 200).

BEFORE RUNNING: start your backend server in another terminal:
    uvicorn app.main:app --reload

Usage:
    python scripts/validate_full_pipeline.py <idea-id-1> <idea-id-2> ...
    Or, with no arguments, reads IDs from scripts/idea_ids.txt (one per line).

For a clean read on the "missing fields" behavior, include at least one idea
that has no tech_stack and/or no duration set — the Technology/Timeline output
for that idea should explicitly list missing_inputs and keep confidence at or
below 60.
"""

import sys
import time
from pathlib import Path

import httpx

DEFAULT_BASE_URL = "http://127.0.0.1:8000"
IDEA_IDS_FILE = Path(__file__).parent / "idea_ids.txt"

STAGES = [
    ("feasibility", "Feasibility"),
    ("scope", "Scope"),
    ("technology", "Technology"),
    ("timeline", "Timeline"),
]


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


def run_stage(base_url: str, endpoint: str, label: str, idea_id: str) -> dict:
    start = time.time()
    try:
        response = httpx.post(f"{base_url}/agents/{endpoint}/{idea_id}", timeout=60)
    except httpx.ConnectError:
        print(f"  [{label}] FAILED: could not connect to the backend.")
        print("            Is `uvicorn app.main:app --reload` running in another terminal?")
        return {"ok": False, "error": "connection failed"}

    elapsed = time.time() - start

    if response.status_code != 200:
        detail = response.text
        try:
            detail = response.json().get("detail", detail)
        except Exception:
            pass
        print(f"  [{label}] FAILED: HTTP {response.status_code} — {detail}")
        return {"ok": False, "error": f"HTTP {response.status_code}: {detail}"}

    body = response.json()
    result = body["result"]
    print(f"  [{label}] {result['verdict']}  (confidence: {result['confidence_score']}/100, {elapsed:.1f}s)")
    if result.get("missing_inputs"):
        print(f"            Missing at submission: {', '.join(result['missing_inputs'])}")
    print(f"            Saved to DB: {body['stored']}")

    return {"ok": True, "verdict": result["verdict"], "missing_inputs": result.get("missing_inputs", []), "stored": body["stored"]}


def run_validation(base_url: str, idea_ids: list[str]) -> list[dict]:
    print(f"Validating the full 4-agent pipeline against {len(idea_ids)} project idea(s)")
    print(f"Backend: {base_url}\n")

    all_results = []

    for idea_id in idea_ids:
        print(f"--- {idea_id} ---")
        idea_ok = True
        stage_results = {}

        for endpoint, label in STAGES:
            outcome = run_stage(base_url, endpoint, label, idea_id)
            stage_results[endpoint] = outcome
            if not outcome["ok"]:
                idea_ok = False
                print(f"  Stopping this idea's chain — {label} failed, later stages need it.")
                break

        all_results.append({"idea_id": idea_id, "ok": idea_ok, "stages": stage_results})
        print()

    print("=" * 64)
    ok_count = sum(1 for r in all_results if r["ok"])
    print(f"SUMMARY: {ok_count}/{len(all_results)} ideas completed the full 4-stage chain")

    flagged = [
        (r["idea_id"], stage)
        for r in all_results
        for stage, outcome in r["stages"].items()
        if outcome.get("missing_inputs")
    ]
    if flagged:
        print(f"\n{len(flagged)} stage(s) correctly flagged missing submission fields:")
        for idea_id, stage in flagged:
            missing = all_results[[r["idea_id"] for r in all_results].index(idea_id)]["stages"][stage]["missing_inputs"]
            print(f"  - {idea_id} / {stage}: {', '.join(missing)}")

    if ok_count < len(all_results):
        print("\nFailed ideas:")
        for r in all_results:
            if not r["ok"]:
                failed_stage = next((s for s, o in r["stages"].items() if not o["ok"]), "?")
                print(f"  - {r['idea_id']}: failed at {failed_stage} — {r['stages'][failed_stage].get('error')}")

    print("\nNow eyeball the output above:")
    print("  - Does Scope's reasoning actually reference Feasibility's verdict?")
    print("  - Does Technology's stack fit what Scope put in_scope, not just the domain in general?")
    print("  - Does Timeline's plan reflect Technology's learning_curve (more weeks where it's steep)?")
    print("  - For any idea missing tech_stack/duration: is missing_inputs populated, and is")
    print("    confidence_score <= 60 for that stage?")
    print("=" * 64)
    return all_results


if __name__ == "__main__":
    ids = load_idea_ids()
    run_validation(DEFAULT_BASE_URL, ids)
