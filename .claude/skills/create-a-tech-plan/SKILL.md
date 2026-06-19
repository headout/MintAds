---
name: create-a-tech-plan
description: Guide users through creating validated implementation plans for features. Use when asked to architect, design, plan, or build a feature, or when breaking down requirements into tasks.
---

# Skill: Architect (Implementation Planning)

## Purpose

Guide the user through creating a validated implementation plan for a feature or requirement. This skill orchestrates the planning workflow, manages user interaction, and delegates heavy work to specialized subagents.

## When to Use

Invoke this skill when:
- User asks to **architect**, **design**, **plan**, or **build** a feature
- User provides requirements and asks "how should we implement this?"
- User wants to break down a feature into tasks
- There's a PRD, spec, or requirement document to implement

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: UNDERSTAND REQUIREMENTS                                │
│                                                                  │
│  0. Spawn requirement-summarizer agent → extract requirements   │
│     - Present requirements list to user, WAIT for confirmation  │
│                                                                  │
│  PHASE 2: FOR EACH REQUIREMENT                                   │
│                                                                  │
│  1. Spawn formulate-approach agent → get approach + assumptions │
│  2. Present to user, WAIT for feedback                          │
│  3. If user suggests changes → spawn user-negotiation agent     │
│  4. Spawn implementation-researcher agent → validate assumptions│
│  5. Present final plan, WAIT for signoff                        │
│  6. Document the task in a markdown file                        │
│  7. Move to next requirement                                    │
│                                                                  │
│  PHASE 3: FINALIZE                                               │
│                                                                  │
│  8. Final review of each task with user                         │
│  9. Check for gaps                                              │
│  10. Spawn story-generation agent → create stories              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical Rule: One Task at a Time

**DO NOT batch-plan multiple tasks.** Process ONE task through the entire loop, get user signoff, then move to the next. Each task gets its own review cycle.

---

## Step-by-Step Process

### Step 0: Understand Requirements

**First**, spawn the requirement-summarizer agent to extract requirements from the PRD/spec:

```
Task tool:
  subagent_type: requirement-summarizer
  prompt: |
    Document: [path to PRD or paste content]
    
    Extract all requirements from this document.
```

The agent will return a structured list:

```
**Requirement 1**: [Short title]
- **Aim**: What this requirement achieves
- **High-level approach**: User-facing description (e.g., "Add a button on the settings screen that opens a confirmation dialog")

**Requirement 2**: [Short title]
- **Aim**: ...
- **High-level approach**: ...
```

**Present to user and WAIT:**

```
"I've identified [N] requirements from the document:

1. **[Title]**: [Aim summary]
2. **[Title]**: [Aim summary]
...

Does this capture all the requirements? Any missing or incorrectly understood?"
```

**WAIT for user confirmation** before proceeding to Phase 2.

---

### Step 1: Spawn formulate-approach Agent

For each requirement (from Step 0), spawn the formulate-approach agent:

```
Task tool:
  subagent_type: formulate-approach
  prompt: |
    Requirement: [paste the requirement text]
    Context: [all context from earlier discussions which includes high level user specific changes]

    Formulate an implementation approach for this requirement.
```

The agent will return:
- What we're building and why
- Assumptions with confidence levels (High/Medium/Low)
- Research questions to validate assumptions

### Step 2: Present to User & WAIT

Present the formulate-approach output to the user:

```
"Here's my thinking on [task]:

**What we're building**: [from agent output]
**How am I building it or high level design**: [agent's description of how the implementation is going to look like]

**Assumptions**:
| # | Assumption | Confidence | Notes |
|---|------------|------------|-------|
| 1 | [assumption] | High | [why] |
| 2 | [assumption] | Medium | ⚠️ Need your input |
| 3 | [assumption] | Low | ❌ Need clarification |

**Questions for you** (Low confidence items):
- [question 1]
- [question 2]

Does this align with your expectations? Any concerns or changes?"
```

**WAIT for user response.** Do NOT proceed until user confirms or provides feedback.

### Step 3: Handle User Feedback

**If user suggests changes or a different approach**, spawn the user-negotiation agent:

```
Task tool:
  subagent_type: user-negotiation
  prompt: |
    My proposed approach: [your approach]
    User's suggested approach: [their suggestion]
    Context: [what we're building]

    Evaluate both approaches and recommend the best path forward.
```

Present the negotiation output to the user and seek explicit decision.

**If user confirms**, proceed to Step 4.

### Step 4: Research the Codebase

Spawn codebase-researcher agents to answer research questions. **Parallelize when possible:**

```
Task tool:
  subagent_type: implementation-researcher
  prompt: |
    Research questions:
    1. [question from formulate-approach output]
    2. [question]
    3. [question]

    Find answers in the codebase. Return file paths and relevant code snippets.
  run_in_background: true  // Parallelize multiple researchers
```

Collect all research results before proceeding.

### Step 5: Present Final Implementation Plan

Combine the approach with research findings:

```
"Here's the implementation plan for [task]:

**What we're building**: [summary]

**Files affected**:
| File | Action | Changes |
|------|--------|---------|
| path/to/file.ts | Modify | [what changes] |
| path/to/new.ts | Create | [what it does] |

**Implementation details**:
- [specific detail 1]
- [specific detail 2]

**Research findings that informed this**:
- [finding 1]
- [finding 2]

Does this plan look good? Any changes before I document and move to the next task?"
```

**WAIT for explicit signoff.**

### Step 6: Document the Task

After user signoff, spawn the `implementation-docs-writer` agent to create or update the task documentation:

```
Task tool:
  subagent_type: implementation-docs-writer
  prompt: |
    Action: CREATE (or UPDATE if file already exists)
    File path: requirements/<feature>-implementation-plan.md

    ## Context

    **Task name**: [task title]
    **Requirement**: [the original requirement text from Step 0]

    **What we're solving**: [problem statement and why this is needed]

    **Agreed approach**: [the full approach from Step 5, including architectural decisions and trade-offs]

    **Research findings**: [all findings from the implementation-researcher in Step 4, including file paths, code patterns, and existing implementations discovered]

    **User decisions**: [any feedback, changes, or explicit decisions the user made during Steps 2-3, including outcomes from user-negotiation if applicable]

    **Files affected**:
    [the complete file changes table from Step 5]

    **Implementation details**:
    [all specific implementation details from Step 5]

    Create comprehensive implementation documentation following your full documentation structure. Ensure the flow diagram, file changes, and acceptance criteria are all complete and consistent.
```

**Important**: Pass ALL accumulated context to the agent — the requirement, approach, research findings, user decisions, and file changes. The agent needs this full context to produce thorough documentation. Do NOT summarize or omit details.

### Step 7: Move to Next Task

```
"Task [N] is complete. Moving to task [N+1]."
```

Return to Step 1 for the next task.

---

## After All Tasks Are Approved

### Step 8: Final Review with User

Walk through EACH task for final confirmation:

```
"Let me walk through each task for final review:

**Task 1: [Title]**
- What: [summary]
- Files: [list]
- Approach: [brief]

Does this look correct? Any changes?"
```

**WAIT for confirmation on EACH task.**

### Step 9: Check for Gaps

```
"We've planned [N] tasks. Are there any missing requirements or gaps?"
```

If user identifies gaps, add new tasks and loop through Steps 1-7.

### Step 10: Generate Stories

Spawn story-generation agent for each task:

```
Task tool:
  subagent_type: story-generation
  prompt: |
    Generate a story for:
    - Requirement: [requirement]
    - Approach: [agreed approach]
    - Research findings: [findings]
    - Documentation: requirements/<feature>-implementation-plan.md
    - Dependencies: [list of dependent tasks]
```

Compile all stories into the final output.

---

## Subagent Reference

| Subagent | When to Spawn | What It Returns |
|----------|---------------|-----------------|
| `requirement-summarizer` | Start of planning (Phase 1) | List of requirements with aims and high-level approaches |
| `formulate-approach` | Start of each requirement (Phase 2) | Articulation, assumptions table, research questions |
| `user-negotiation` | When user suggests different approach | Comparison, tradeoffs, recommendation |
| `implementation-researcher` | After approach agreement | Codebase findings, file paths, code patterns |
| `implementation-docs-writer` | After user signoff on each task (Step 6) | Comprehensive implementation documentation with approach, flow diagrams, file changes, and acceptance criteria |
| `story-generation` | After all tasks approved (Phase 3) | Formatted story with subtasks |

---

## Self-Check Before Each Step

Before proceeding, verify:

- [ ] Did I start with requirement-summarizer? (Step 0)
- [ ] Did I get user confirmation on the requirements list?
- [ ] Did I spawn the appropriate subagent for the current step?
- [ ] Did I present results to the user?
- [ ] Did I WAIT for user response?
- [ ] If user suggested changes, did I spawn user-negotiation?
- [ ] Did I get explicit signoff before moving on?

**If any checkbox is NO, go back and complete that step.**

---

## Anti-patterns

- **Skipping subagent spawns**: Don't do the work yourself, delegate to subagents
- **Not waiting for user**: Always WAIT after presenting information
- **Batch planning**: Don't plan all tasks at once, go one by one
- **Ignoring low confidence**: STOP and ask user about low confidence items
- **Accepting changes without negotiation**: Always spawn user-negotiation when user suggests changes

---

## Output

At the end of this workflow, you should have:
1. A documented implementation plan in `requirements/<feature>-implementation-plan.md`
2. User-approved tasks with clear approaches
3. Generated stories ready for developer agents
