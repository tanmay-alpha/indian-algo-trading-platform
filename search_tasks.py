import json

filepath = r"C:\Users\TANMAY\.gemini\antigravity\brain\6d57da82-5d20-4eed-92be-332d4ddf4716\.system_generated\logs\overview.txt"
model_responses = []
with open(filepath, "r", encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get("source") == "MODEL" and data.get("step_index") < 21645:
                model_responses.append(data)
        except Exception:
            pass

print(f"Total old model entries: {len(model_responses)}")
for idx, res in enumerate(model_responses[-10:]):
    print(f"\n==================== Old Entry {idx} (Step {res.get('step_index')}) ====================")
    print("Keys:", list(res.keys()))
    for k, v in res.items():
        if v:
            print(f"  {k}: {str(v)[:400]}")
