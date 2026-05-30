import json
filepath = r"C:\Users\TANMAY\.gemini\antigravity\brain\6d57da82-5d20-4eed-92be-332d4ddf4716\.system_generated\logs\overview.txt"
with open(filepath, "r", encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            source = data.get("source", "")
            step = data.get("step_index", 0)
            if source == "MODEL" and 21645 <= step <= 22126:
                # Print the model's text response/thought/tool calls
                print(f"Step {step}: {source} -> keys: {list(data.keys())}")
                # print first few tool calls
                if "tool_calls" in data:
                    print("  Tools called:", [t["name"] for t in data["tool_calls"]])
                # print summary/thought if any
                for key in ["thought", "summary", "text", "content"]:
                    if key in data:
                        print(f"  {key}: {str(data[key])[:400]}")
                print("-" * 50)
        except Exception as e:
            pass
