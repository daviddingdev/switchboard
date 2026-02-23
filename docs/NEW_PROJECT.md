# Setting Up a New Project

Quick reference for partner when creating new projects on Spark.

## 1. Create Project Directory

```bash
mkdir ~/new-project
cd ~/new-project
```

## 2. Initialize Git

```bash
git init
```

## 3. Create CLAUDE.md

Every project needs a `CLAUDE.md` with at least:

```markdown
# Project Name

Brief description.

## Quick Start

How to run/use the project.

## File Structure

Key files and their purpose.
```

This enables:
- Auto-discovery in orchestrator UI
- Claude Code context when working in the project

## 4. Create GitHub Repo

Go to: https://github.com/new

- **Owner**: `daviddingstudent-create` (or change as needed)
- **Name**: same as directory name
- **Visibility**: Private
- Leave all other options unchecked (no README, no .gitignore)

Click "Create repository"

## 5. Connect and Push

```bash
git remote add origin git@github.com:daviddingstudent-create/new-project.git
git add -A
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

## 6. Optional Files

| File | Purpose |
|------|---------|
| `CHANGELOG.md` | Track changes by date |
| `TODO.md` | Current tasks |
| `.gitignore` | Exclude logs, data, venv, etc. |

## Common .gitignore

```
__pycache__/
*.pyc
.venv/
venv/
logs/
*.log
.env
*.db
node_modules/
dist/
```

## Git Commands Reference

```bash
git status                    # Check what's changed
git add -A                    # Stage all changes
git add file.py               # Stage specific file
git commit -m "message"       # Commit
git push                      # Push to GitHub
git pull                      # Pull from GitHub
git log --oneline -5          # Recent commits
```

## Changing GitHub Org

If you need to use a different org/account, replace `daviddingstudent-create` with the new org name in the remote URL.
