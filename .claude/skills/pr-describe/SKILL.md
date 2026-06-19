---
name: pr-describe
description: Generate PR titles and descriptions optimized for human reviewers
---

# PR Describe

Generate or update PR titles and descriptions by analyzing the diff, session context, and planning docs.

## When to Use

- User provides a PR number or GitHub PR URL
- User says "describe this PR", "write PR description", "update PR title"
- User wants to create a new PR with a well-crafted description

## Process

### Step 1: Parse Input

- Accept PR number (`123`, `#123`) or full GitHub URL
- **No PR number/URL provided** = "create" mode: use current branch to create a new PR
- **PR number provided** = "edit" mode: update existing PR
- Validate:
  - Edit mode: `gh pr view <N> --json number`
  - Create mode: confirm current branch has commits ahead of base

### Step 2: Fetch PR Metadata

```bash
# Edit mode
gh pr view <N> --json title,body,headRefName,baseRefName,commits,files,additions,deletions,state,author
gh pr diff <N>

# Create mode
git log --oneline origin/main..HEAD
git diff origin/main...HEAD
```

### Step 3: Check for PR Template

Search in order:
1. `.github/PULL_REQUEST_TEMPLATE.md`
2. `.github/pull_request_template.md`
3. `PULL_REQUEST_TEMPLATE.md`
4. `pull_request_template.md`
5. `.github/PULL_REQUEST_TEMPLATE/` directory

If found, use it as the description skeleton. If not, use the structure in Step 7.

### Step 4: Gather Session Context

- Review conversation history for what was done and why
- Search for related planning docs:
  - `thoughts/shared/plans/`, `thoughts/shared/handoffs/`, `thoughts/ledgers/`
  - `~/.claude/plans/`
  - Any other coding agent planning directories
- Look for docs/specs created as part of this work
- If docs not found but seem needed (complex PR with unclear motivation), ask user for context
- **CRITICAL:** Only include context that directly correlates to the PR diff. Cross-reference plan/doc content against actual changed files before including.

### Step 5: Analyze the Diff

- Group changed files by logical module/area (not alphabetical)
- Identify: new features, bug fixes, refactors, config changes, migrations, test additions
- Detect config changes (`.env`, `*.config.*`, `*.yml`, `docker-compose`, etc.)
- Detect migration files (DB migrations, schema changes)
- Detect test files added/modified

### Step 6: Interview User for Validation Info

Use `AskUserQuestion` to ask:
- What testing/validation was done? (unit tests, functional tests, dry runs, manual QA)
- Any deployment notes or rollback considerations?

Only ask if this info is not discoverable from session context or PR diff.

### Step 7: Generate Title & Description

**Title format:** `<type>: <concise summary>`

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `ci`

Derive type from diff analysis (new files = feat, bug fix patterns = fix, etc.)

**Description structure (when no template):**

```markdown
## Summary
<2-4 sentences: what changed and why>

## Changes
<Logically grouped file changes with brief explanations>
### <Module/Area 1>
- file changes and what they do
### <Module/Area 2>
- file changes and what they do

## Config & Migrations
<Only if applicable - config changes, env vars, DB migrations>

## Testing & Validation
<What was tested - unit tests, functional tests, dry runs, manual QA>

## Notes for Reviewers
<Optional: key areas to focus review on, tradeoffs made, follow-up work>
```

### Step 8: Apply to PR

Present the generated title + description to user FIRST. Apply only after user confirms.

**Edit mode:**
```bash
echo "$BODY" > /tmp/pr-body.md
gh pr edit <N> --title "<new title>" --body-file /tmp/pr-body.md
rm /tmp/pr-body.md
```

**Create mode:**
```bash
echo "$BODY" > /tmp/pr-body.md
gh pr create --title "<new title>" --body-file /tmp/pr-body.md
rm /tmp/pr-body.md
```

When creating: detect current branch, confirm base branch with user, then create.

## Requirements

- **gh CLI**: Must be installed and authenticated
  ```bash
  gh auth status
  ```
- **Git**: Standard git commands
- **Repository context**: Must be run from within a git repository
