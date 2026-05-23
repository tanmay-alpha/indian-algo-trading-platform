# RAM And Heat Safety Guide

## Hardware

- HP Omen 14
- RTX 4060 8GB
- Intel i7-14650HX
- 16GB RAM
- 1TB SSD

## Main Rule

Use only one heavy agent at a time.

Do not run these together:

- Gemini CLI
- Codex CLI
- Cline
- Ollama
- n8n
- Playwright browser automation
- many Chrome tabs

## Safe Modes

### Lightweight Mode

- VS Code
- PowerShell
- ChatGPT in browser

### Coding Mode

- VS Code
- Codex CLI or Codex panel

### Analysis Mode

- VS Code
- Gemini CLI

### MCP Tool Mode

- VS Code
- Cline
- needed MCP servers only

### Local Fallback Mode

- VS Code
- Ollama qwen2.5-coder:7b
- Continue or Cline

## Check Running Tools

```powershell
pm2 status
ollama ps
Get-Process node, python, ollama, code, n8n, codex, gemini -ErrorAction SilentlyContinue |
Sort-Object CPU -Descending |
Select-Object ProcessName, Id, CPU, WorkingSet64
```
