# Prompt: ML Project Audit

> Use to audit an ML or data science project before sharing or deploying.

---

## Task

Audit the ML/data science project at: `[PROJECT_PATH]`

**Project goal:** `[e.g., classification / regression / time-series forecasting / RAG pipeline]`

## What to Analyze

### Code Quality
- [ ] Are data loading steps clearly separated from model training?
- [ ] Are random seeds set for reproducibility? (`numpy.random.seed`, `torch.manual_seed`)
- [ ] Is the train/val/test split done correctly? (no data leakage between splits)
- [ ] Are preprocessing steps applied consistently to train and inference data?

### Data Handling
- [ ] Is data loading code separated from model code?
- [ ] Are data file paths configurable (not hardcoded)?
- [ ] Are large data files excluded from git? (check `.gitignore` for `*.csv`, `*.parquet`, `data/`, `models/`)
- [ ] Are data schemas documented?

### Model Safety
- [ ] Is model serialization using a safe format? (`joblib`, `safetensors` — not `pickle` for untrusted data)
- [ ] Are model artifacts excluded from git? (`*.pkl`, `*.pt`, `*.h5`, `models/`)
- [ ] Is there a model versioning strategy?

### Reproducibility
- [ ] Can another developer reproduce results from scratch with a single command?
- [ ] Are all dependencies pinned in `requirements.txt` or `pyproject.toml`?
- [ ] Is the data source documented (URL, version, date accessed)?

### CI Safety
- [ ] Does CI run only syntax/import checks and fast unit tests?
- [ ] Does CI NOT run model training? (training should never run in CI)
- [ ] Does CI NOT require GPUs or large data downloads?

### Secrets
- [ ] Are API keys for data providers in `.env` only?
- [ ] Are Hugging Face / OpenAI / cloud provider credentials absent from source code?

## Output Format

1. **Reproducibility score** (0–10) with explanation
2. **Data leakage risks** identified
3. **Security issues** (credentials, unsafe serialization)
4. **CI compatibility** (can CI run without GPUs or data?)
5. **Recommended fixes** in priority order
