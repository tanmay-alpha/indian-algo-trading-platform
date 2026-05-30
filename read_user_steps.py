import os
base_dir = r"C:\Users\TANMAY\.gemini\antigravity\brain\6d57da82-5d20-4eed-92be-332d4ddf4716"
for root, dirs, files in os.walk(base_dir):
    # Skip steps directory if it's too large, but list other directories
    if ".system_generated" in root and "steps" in root:
        continue
    print(f"Directory: {root}")
    for f in files:
        path = os.path.join(root, f)
        print(f"  File: {f} ({os.path.getsize(path)} bytes)")
