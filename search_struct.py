import json

overview_path = r"C:\Users\TANMAY\.gemini\antigravity\brain\6d57da82-5d20-4eed-92be-332d4ddf4716\.system_generated\logs\overview.txt"

with open(overview_path, "r", encoding="utf-8") as f:
    for line in f:
        if '"source":"USER"' in line or '"USER_INPUT"' in line:
            try:
                data = json.loads(line)
                print(f"Keys: {list(data.keys())}")
                # print the dict
                print(data)
                break
            except Exception as e:
                print("Error parsing", e)
