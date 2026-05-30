with open("docs/roadmap_audit.md", "r", encoding="utf-8") as f:
    content = f.read()
    idx = content.find("## 8. Roadmap")
    if idx != -1:
        print(content[idx:idx+15000])
    else:
        print("Not found")
