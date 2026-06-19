---
name: resolve-pr-comments
description: Resolve PR review comments by making code changes and replying in the same thread
---

# Resolve PR Comments

Fetch PR review comments, make code changes to address them, and reply to the same comment thread.

## When to Use

- User says "resolve PR comments", "address review feedback", "fix PR comments"
- User wants to work through review comments on their PR
- After receiving code review feedback

## Process

### Step 1: Identify the PR

**If a PR number/URL was provided as argument:**
- Extract the PR number
- Validate: `gh pr view <N> --json number,headRefName`

**If no argument provided:**
- Auto-detect from current branch:
  ```bash
  gh pr view --json number,headRefName,url
  ```
- If no PR found, tell the user and stop

### Step 2: Detect Repository Owner/Repo

Extract owner and repo from the git remote:
```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'
```
This returns `owner/repo` format needed for API calls.

### Step 3: Fetch Review Comments

Fetch all review comments on the PR:
```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --jq '[.[] | {id, in_reply_to_id, path, line, original_line, side, diff_hunk, body, user: .user.login, created_at, updated_at}]'
```

### Step 4: Group Into Threads

Group comments by thread:
- Comments with `in_reply_to_id == null` are **thread starters**
- Comments with `in_reply_to_id != null` are **replies** (group under their parent)
- For each thread, the **top-level comment ID** (thread starter) is what we use for replies

### Step 5: Filter to Actionable Comments

Skip threads where:
- The last reply in the thread is from the PR author (likely already addressed)
- The comment is purely a compliment or acknowledgment (no action needed)

Present the remaining actionable threads to the user:
```
Found N actionable review comments on PR #X:

1. [path/to/file.ts:42] @reviewer: "Consider using const here instead of let"
2. [path/to/other.ts:15] @reviewer: "This should handle the null case"
...

Shall I work through these one by one?
```

### Step 6: Process Each Comment

For each actionable comment thread:

1. **Show the comment context:**
   - Display the `diff_hunk` from the comment
   - Display the comment body and any replies in the thread
   - Display the file path and line number

2. **Read the current file:**
   - Read the file at the path specified in the comment
   - Understand the surrounding code context

3. **Make the code change:**
   - Analyze what the reviewer is asking for
   - Make the appropriate edit to the file
   - Show the user what was changed

4. **Ask user to confirm:**
   - Present the change made
   - Ask: "Does this address the comment? Should I commit and reply?"
   - Options:
     - **Yes, commit and reply** — commit the change, push, and reply to the thread
     - **Yes, but don't commit yet** — keep the change, reply to thread, move to next
     - **Skip this comment** — revert the change, move to next
     - **Let me handle this manually** — leave the change for the user, move to next

5. **Reply to the comment thread:**

   **CRITICAL: Always reply to the SAME thread. NEVER create a new top-level comment.**

   - Use the **top-level comment ID** for the reply
   - If the comment itself is a reply (`in_reply_to_id != null`), find the thread starter ID by tracing `in_reply_to_id` back to the root

   ```bash
   gh api repos/{owner}/{repo}/pulls/{pr_number}/comments/{top_level_comment_id}/replies \
     -f body="Addressed: <short summary of what was changed>"
   ```

   **NEVER use this (it creates a NEW top-level comment):**
   ```bash
   # WRONG - creates new thread
   gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
     -f body="..." -f commit_id="..." -f path="..." -f line=10
   ```

   **NEVER use this (it creates a general issue comment, not a review reply):**
   ```bash
   # WRONG - creates issue-level comment
   gh api repos/{owner}/{repo}/issues/{pr_number}/comments \
     -f body="..."
   ```

6. **If committing:**
   ```bash
   git add <changed_file>
   git commit -m "review: <short description of change>"
   git push
   ```

### Step 7: Summary

After all comments are processed, show a summary:
```
PR Comment Resolution Summary:
- Resolved: N comments (committed and replied)
- Skipped: M comments
- Pending: K comments (changes made but not committed)

Files modified: [list]
```

## Reply Format

Replies should be concise and informative:
- "Addressed: renamed `getData` to `fetchUserData` for clarity"
- "Addressed: added null check before accessing `user.email`"
- "Addressed: switched from `let` to `const` since value is never reassigned"

## Error Handling

- **No PR found**: "No open PR found for current branch. Provide a PR number: `/resolve-pr-comments 123`"
- **No review comments**: "No review comments found on PR #X"
- **gh CLI not authenticated**: "Please run `gh auth login` first"
- **Push fails**: Show error, suggest user resolves manually
- **Comment too complex**: "This comment may require architectural changes. Skipping — please address manually."

## Requirements

- **gh CLI**: Must be installed and authenticated (`gh auth status`)
- **Git**: Standard git commands, must be in a git repo
- **Push access**: Need push access to the branch for commit+push
