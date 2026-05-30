import os

base_dir = r"C:\Users\TANMAY\.gemini\antigravity\brain\6d57da82-5d20-4eed-92be-332d4ddf4716"
f1 = os.path.join(base_dir, "audit_results_phase26.md")
f2 = os.path.join(base_dir, "code_cleanup_audit_report.md")

print(f"=== {os.path.basename(f1)} ===")
with open(f1, "r", encoding="utf-8") as f:
    print(f.read())

print(f"\n=== {os.path.basename(f2)} ===")
with open(f2, "r", encoding="utf-8") as f:
    print(f.read())
