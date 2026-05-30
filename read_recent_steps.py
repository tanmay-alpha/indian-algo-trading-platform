import json
filepath = r"C:\Users\TANMAY\.gemini\antigravity\brain\6d57da82-5d20-4eed-92be-332d4ddf4716\.system_generated\logs\overview.txt"
with open(filepath, "r", encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get("step_index", 0)
            if 22080 <= step <= 22125:
                print("Step", step, "source:", data.get("source"), "type:", data.get("type"))
                if "tool_calls" in data:
                    for tc in data["tool_calls"]:
                        print("  Tool:", tc.get("name"))
                        args = tc.get("args", {})
                        for k, v in args.items():
                            if k in ["CommandLine", "TargetFile", "path", "AbsolutePath"]:
                                print(f"    {k}: {v}")
                            elif k in ["ReplacementContent", "TargetContent"]:
                                print(f"    {k}: {str(v)[:300]}...")
        except Exception:
            pass
