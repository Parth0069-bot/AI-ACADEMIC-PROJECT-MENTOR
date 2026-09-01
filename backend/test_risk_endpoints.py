import httpx
import json

base_url = "http://127.0.0.1:8000"
idea_ids = [
    "737ccf17-b3cd-4d26-8358-607512efb2ec",
    "f2fd3f45-c8a2-4368-a6b2-a60abbc2484a"
]

endpoints = ["feasibility", "scope", "technology", "timeline", "risk"]

for idea_id in idea_ids:
    print(f"\n{'='*50}\nTesting Idea: {idea_id}\n{'='*50}")
    
    # Run the 5 agent endpoints sequentially
    for agent in endpoints:
        print(f"\n--- Running {agent.upper()} Agent ---")
        try:
            r = httpx.post(f"{base_url}/agents/{agent}/{idea_id}", timeout=60.0)
            if r.status_code == 200:
                print("SUCCESS (200)")
                if agent == "risk":
                    with open(f"risk_result_{idea_id}.json", "w") as f:
                        json.dump(r.json(), f, indent=2)
                    print(f"Risk output saved to risk_result_{idea_id}.json")
            else:
                print(f"FAILED ({r.status_code}): {r.text}")
                break
        except Exception as e:
            print(f"EXCEPTION: {e}")
            break

    # Fetch final feedback
    print(f"\n--- Fetching GET /agents/feedback/{idea_id} ---")
    try:
        r = httpx.get(f"{base_url}/agents/feedback/{idea_id}", timeout=60.0)
        if r.status_code == 200:
            with open(f"feedback_{idea_id}.json", "w") as f:
                json.dump(r.json(), f, indent=2)
            print(f"Feedback saved to feedback_{idea_id}.json")
        else:
            print(f"FAILED ({r.status_code}): {r.text}")
    except Exception as e:
        print(f"EXCEPTION: {e}")
