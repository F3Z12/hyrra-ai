# GitHub Publishing Guide

This document contains the exact steps and commands to safely publish Hyrra AI to GitHub.

> [!CAUTION]  
> **WHAT MUST NEVER BE PUBLIC**
> Do not expose the exact implementation code of your core AI extraction, matching algorithms, or extension content scripts. Never push `.env` files, OpenAI API keys, local `*.db` SQLite files, user resumes, saved jobs, generated ZIPs/CSVs, or screenshots that contain un-anonymized personal data.

---

## 1. Publishing the Private Repository (Full Source Code)

This repository (`hyrra-ai-private`) will house your actual application code. It must be kept private.

### Checklist Before Pushing:
- [ ] Ensure your `.gitignore` is intact and lists `.env`, `*.db`, `node_modules/`, and `__pycache__/`.
- [ ] Run `git status` locally. Verify that `backend/job_intelligence.db` or `.env` do NOT appear in the "Changes to be committed" list.

### Commands to Push Privately:
Do **not** run these commands if any sensitive files are currently staged!

```bash
# 1. Initialize git (if not already done)
git init

# 2. Add all safe files to staging
git add .

# 3. Commit the codebase
git commit -m "Initial commit: Hyrra AI MVP"

# 4. Link to your new PRIVATE GitHub repository
git remote add origin https://github.com/yourusername/hyrra-ai-private.git

# 5. Push the code
git push -u origin main
```

---

## 2. Publishing the Public Showcase Repository

The public repository (`hyrra-ai-showcase`) will act as your portfolio piece and architectural case study. It must **not** contain any source code files (`.py`, `.tsx`, `.ts`).

### Checklist Before Pushing:
- [ ] You have manually created a new, empty folder on your computer (e.g., `Desktop/hyrra-ai-showcase`).
- [ ] You have manually copied the contents of `public_showcase/` into that new folder.
- [ ] You have renamed the copied `README.md` to be the primary README for the new folder.
- [ ] You have verified that no source code files or `.db` files accidentally copied over.

### Commands to Push Publicly:
Run these commands *inside the new, isolated showcase folder*:

```bash
# 1. Initialize git in the new showcase folder
git init

# 2. Add the safe markdown files and assets
git add .

# 3. Commit the showcase
git commit -m "Initial commit: Hyrra AI Case Study"

# 4. Link to your new PUBLIC GitHub repository
git remote add origin https://github.com/yourusername/hyrra-ai-showcase.git

# 5. Push the showcase
git push -u origin main
```
