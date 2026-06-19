---
name: execute-a-plan
description: Execute a technical implementation plan like a program manager. Analyzes task dependencies, creates a dependency graph, orchestrates parallel developer agents for independent tasks, and triggers code reviews. Use after a plan is created via create-a-tech-plan.
---

# Skill: Execute a Plan (Technical Program Manager)

## Purpose

Act as an efficient technical program manager who reads a technical implementation document, analyzes task dependencies, builds a dependency graph, and orchestrates developer agents to execute tasks in optimal order with code reviews.

## When to Use

Invoke this skill when:
- A technical implementation plan exists and is ready for execution
- User says "execute this plan" or "implement these tasks"
- User wants to start development based on an approved implementation document
- There's a `requirements/<feature>-implementation-plan.md` ready to be implemented

## Prerequisite: Implementation Plan Document

**This skill requires an implementation plan document.** Do NOT proceed without one.

If a document path is provided → Read it and proceed.

If no document is provided → Ask the user:

```
"I need an implementation plan document to execute. Do you have one available?

This could be:
- A technical spec at `requirements/<feature>-implementation-plan.md`
- A document created via the create-a-tech-plan skill
- Any structured document with tasks, file changes, and acceptance criteria

Please provide the path to the document, or let me know if you'd like to create a plan first."
```

**Do NOT attempt to execute without a planning document.** The document provides:
- Task definitions and scope
- File changes for each task
- Acceptance criteria for code reviews
- Context for developer agents

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: ANALYZE                                               │
│                                                                  │
│  1. Read the implementation plan document                       │
│  2. Extract all tasks with their file changes                   │
│  3. If file changes not specified → explore codebase            │
│                                                                  │
│  PHASE 2: BUILD DEPENDENCY GRAPH                                 │
│                                                                  │
│  4. Categorize tasks: Foundational / Dependent / Independent    │
│  5. Map dependencies between tasks                              │
│  6. Create execution order                                      │
│  7. Present dependency graph to user, WAIT for approval         │
│                                                                  │
│  PHASE 3: EXECUTE (for each task)                                │
│                                                                  │
│  8. Execute foundational tasks first (sequential)               │
│  9. Execute dependent/independent tasks (parallel where safe)   │
│  10. Code review + fix blockers/majors (per task, inline)       │
│                                                                  │
│  PHASE 4: FINALIZE                                               │
│                                                                  │
│  11. Structured summary of all tasks and review results         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task Categories

### Foundational Tasks
Tasks that MUST complete before any other work can begin:
- Database schema changes (migrations, new tables, columns)
- Package installations or dependency updates
- Environment configuration changes
- Core type definitions that other code depends on

**Execution**: Always sequential, always first.

### Dependent Tasks
Tasks that require other tasks to complete first:
- A service that uses a utility created in another task
- A frontend component that consumes an API built in another task
- Any task that imports/uses code from another task

**Execution**: Sequential within dependency chain, parallel across independent chains.

### Independent Tasks
Tasks with no dependencies on other tasks in the plan:
- Separate features that don't share code
- Tasks modifying completely different parts of the codebase
- Tasks with no overlapping files

**Execution**: Parallel (multiple developer agents simultaneously).

---

## Step-by-Step Process

### Phase 1: Analyze

#### Step 1: Read the Implementation Plan

**First, check if an implementation plan document is provided or exists.**

**If document path is provided**: Read it directly.

**If no document path provided**: Ask the user:
```
"I need an implementation plan document to proceed. Do you have one available?
Please provide the path, or let me know if you'd like to create a plan first using the create-a-tech-plan skill."
```

**STOP and WAIT for a valid document before proceeding.**

---

Once you have the document, read it and extract:

```
Read the implementation plan document at:
[provided path or requirements/<feature>-implementation-plan.md]

Extract:
- All tasks/stories listed
- File changes for each task
- Acceptance criteria for each task
```

#### Step 2: Identify File Changes

For each task, identify which files will be created or modified.

**If file changes are specified in the plan**: Use those directly.

**If file changes are NOT specified**: Spawn an exploration agent:

```
Task tool:
  subagent_type: implementation-researcher
  prompt: |
    Task: [task description]
    
    Determine what files need to be created or modified to implement this task.
    Return a list of file paths with the type of change (create/modify).
```

#### Step 3: Build File Change Map

Create a map of all tasks and their file changes:

```
Task 1: "Add user_type column to database"
  - CREATE: database/migrations/xxx-add-user-type.sql
  - MODIFY: src/database/schema/users.schema.ts

Task 2: "Create user type API endpoint"
  - MODIFY: src/features/users/routes/user.routes.ts
  - MODIFY: src/features/users/services/user.service.ts
  - CREATE: src/features/users/types/userType.ts

Task 3: "Add user type dropdown to UI"
  - CREATE: client/src/components/UserTypeDropdown.tsx
  - MODIFY: client/src/pages/UserSettings.tsx
```

---

### Phase 2: Build Dependency Graph

#### Step 4: Categorize Tasks

**Foundational tasks** (execute first):
- Any task touching `database/migrations/` or `database/init/`
- Any task that only creates type definitions
- Any task installing packages
- Any task modifying environment config

**Dependent tasks** (has prerequisites):
- Task B depends on Task A if:
  - Task B modifies a file that Task A creates
  - Task B imports from a file that Task A creates/modifies
  - Task B's description references using logic from Task A

**Independent tasks** (no prerequisites):
- No file overlap with other tasks
- No import dependencies on other tasks
- Can be executed in any order

#### Step 5: Map Dependencies

For each task, determine:
1. What files does this task create?
2. What files does this task modify?
3. Do any other tasks create files this task needs to import from?

Build dependency relationships:

```
Task 1 (Foundational) → Task 2 → Task 3
                      ↘ Task 4 (Independent of Task 3)
Task 5 (Independent - no overlaps)
```

#### Step 6: Create Execution Order

Group tasks into execution waves:

```
Wave 0 (Foundational - Sequential):
  - Task 1: Database migration

Wave 1 (Can run in parallel after Wave 0):
  - Task 2: Backend API
  - Task 5: Unrelated feature

Wave 2 (Depends on Wave 1):
  - Task 3: Frontend (depends on Task 2)
  - Task 4: Another API (depends on Task 2)
```

#### Step 7: Present to User

```
"Here's the execution plan:

## Dependency Graph

Task 1: [title] (Foundational)
  └── Task 2: [title]
        ├── Task 3: [title]
        └── Task 4: [title]
Task 5: [title] (Independent)

## Execution Order

**Wave 0** (Sequential - Foundational):
| Task | Description | Files |
|------|-------------|-------|
| Task 1 | [desc] | [files] |

**Wave 1** (Parallel - 2 developer agents):
| Task | Description | Files |
|------|-------------|-------|
| Task 2 | [desc] | [files] |
| Task 5 | [desc] | [files] |

**Wave 2** (Parallel - 2 developer agents):
| Task | Description | Files |
|------|-------------|-------|
| Task 3 | [desc] | [files] |
| Task 4 | [desc] | [files] |

Does this execution order look correct?"
```

**WAIT for user approval before executing.**

---

### Phase 3: Execute

#### Step 8: Execute Foundational Tasks

Execute foundational tasks one at a time (sequential):

```
Task tool:
  subagent_type: developer-agent
  prompt: |
    Implementation plan: requirements/<feature>-implementation-plan.md
    
    Execute Task 1: [task title]
    
    Description: [full task description]
    
    Files to change:
    - [file list with create/modify actions]
    
    Acceptance criteria:
    - [criteria from plan]
```

**After each foundational task completes**, run code review + fix loop (see Step 10).

#### Step 9: Execute Dependent/Independent Tasks

For each wave, spawn developer agents in parallel for independent tasks:

```
# Wave 1 - spawn 2 agents in parallel
Task tool (Agent 1):
  subagent_type: developer-agent
  prompt: |
    Execute Task 2: [description]
    ...

Task tool (Agent 2):
  subagent_type: developer-agent
  prompt: |
    Execute Task 5: [description]
    ...
```

**Important**: Only parallelize tasks within the same wave. Tasks in later waves must wait for their dependencies.

#### Step 10: Code Review + Fix (Per Task, Inline)

**This step runs immediately after EACH task completes** (both foundational and wave tasks). Blockers and majors are fixed before moving to the next task/wave.

**10a. Run code review:**

```
Task tool:
  subagent_type: code-review-analyst
  prompt: |
    Review the implementation of: [task title]

    Implementation plan: requirements/<feature>-implementation-plan.md

    Files changed:
    - [list of files]

    Acceptance criteria:
    - [criteria]

    Provide:
    1. Code quality comments (blockers, major issues, suggestions, nits)
    2. Feature completeness check against acceptance criteria
    3. Acceptance criteria match: list each criterion as MET or NOT MET
```

**10b. If blockers or major issues found → fix immediately:**

```
Task tool:
  subagent_type: developer-agent
  prompt: |
    Fix code review issues for: [task title]

    ## Code Review Findings

    ### Blockers (Must Fix)
    [paste blocker comments from code-review-analyst]

    ### Major Issues (Must Fix)
    [paste major issue comments from code-review-analyst]

    ## Files to Fix
    - [list of files with issues]

    ## Instructions
    - Address ALL blockers - these must be fixed
    - Address ALL major issues - these must be fixed
    - Follow the suggested fixes provided in the review comments
    - Do not change code unrelated to the review findings
```

**10c. Fix-Review Loop (inline, per task):**

```
┌─────────────────────────────────────────────┐
│  developer-agent implements task            │
│              ↓                              │
│  code-review-analyst reviews (10a)          │
│              ↓                              │
│  Has blockers/major issues?                 │
│     YES → developer-agent fixes (10b)       │
│           → re-review (back to 10a)         │
│     NO  → task is DONE, proceed             │
└─────────────────────────────────────────────┘
```

**Important**:
- Blockers AND majors are **always fixed** before proceeding to the next task
- Re-run code review after fixes to verify issues are resolved
- Only loop a maximum of 3 times - if issues persist, flag for human review
- Suggestions and nits are recorded but NOT fixed inline (collected for final summary)
- Do NOT defer fixing to a later step - fix happens immediately after review

---

### Phase 4: Finalize

#### Step 11: Structured Summary

Present the final structured summary to the user. This is the primary output of the skill.

**For each task, output ALL three sections:**

```
## Execution Summary

### Tasks Completed: X/Y

---

#### Task 1: [Task Title]

**Code Review Status**: ✅ Passed (or ⚠️ Passed after fixes)
- Blockers: X found, X fixed
- Majors: X found, X fixed
- Pending Suggestions: [summary of any unfixed suggestions]
- Pending Nits: [summary of any unfixed nits]

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | [criterion text] | ✅ MET |
| 2 | [criterion text] | ✅ MET |
| 3 | [criterion text] | ❌ NOT MET - [reason] |

---

#### Task 2: [Task Title]

**Code Review Status**: ✅ Passed
- Blockers: 0
- Majors: 0
- Pending Suggestions: None
- Pending Nits: 1 - [brief description]

**Acceptance Criteria**:
| # | Criterion | Status |
|---|-----------|--------|
| 1 | [criterion text] | ✅ MET |

---

### Remaining Items (Suggestions & Nits)

If there are unfixed suggestions or nits across tasks, provide a consolidated list
that can be handed to a single developer agent to fix in one pass:

| Task | Type | Description | File(s) |
|------|------|-------------|---------|
| Task 1 | Suggestion | [description] | [file:line] |
| Task 3 | Nit | [description] | [file:line] |

All blockers and major issues have been resolved. The above suggestions/nits
are optional improvements that can be addressed in a follow-up pass.
```

---

## Subagent Reference

| Subagent | When to Spawn | What It Returns |
|----------|---------------|-----------------|
| `implementation-researcher` | When file changes not specified | List of files to create/modify |
| `developer-agent` | For each task execution AND each fix pass | Implemented code changes |
| `code-review-analyst` | After each task completes (and after each fix) | Review comments, acceptance criteria match |

---

## Dependency Detection Rules

### File-based Dependencies

```
If Task A creates: src/utils/helper.ts
And Task B modifies: src/services/service.ts (which imports from helper.ts)
Then: Task B depends on Task A
```

### Explicit Dependencies

Look for phrases in task descriptions:
- "uses the X created in Task Y"
- "depends on the API from Task Y"
- "after Task Y is complete"

### Layer-based Dependencies (default assumption)

When in doubt, assume this dependency order:
1. Database/Schema changes
2. Backend types/interfaces
3. Backend services/APIs
4. Frontend types
5. Frontend components

---

## Anti-patterns

- **Skipping dependency analysis**: Always build the graph first
- **Over-parallelizing**: Don't run tasks in parallel if they touch the same files
- **Skipping reviews**: Every task gets a code review
- **Ignoring blockers**: Fix blockers before proceeding to dependent tasks
- **Deferring major fixes**: Never defer blocker/major fixes to a later step - fix them inline after review
- **Not waiting for waves**: Complete all tasks in a wave before starting the next

---

## Output

At the end of execution, you must produce a structured summary with:
1. **Per task**: Task name, code review status (blockers/majors fixed, pending suggestions/nits), acceptance criteria match
2. **Overall**: All blockers and major issues resolved
3. **Remaining items**: Consolidated table of unfixed suggestions/nits for optional follow-up
