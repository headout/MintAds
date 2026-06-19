---
name: create-a-project
description: Help product managers create detailed, specific product requirement documents through deep questioning. Identifies entities, actions, and workflow impacts. Use when user wants to define a new feature or write a PRD.
---

# Skill: Create a Product Requirement Document

## Purpose

Act as a rigorous product partner who helps product managers create comprehensive, unambiguous requirement documents through deep questioning, entity/action analysis, and codebase exploration.

## When to Use

Invoke this skill when:
- User says "I want to build..." or "I need a feature for..."
- User wants help writing a PRD or requirement document
- User has a feature idea but hasn't fully specified it
- User asks to define requirements for a new capability

## Core Principles

1. **Dream extraction, not requirements gathering** - The user has a fuzzy idea. Your job is to help them sharpen it through collaborative thinking, not interrogation.

2. **Specificity over vagueness** - Never accept fuzzy answers. "Good" means what? "Users" means who? "Simple" means how? Every requirement must be concrete enough that a stranger could understand it.

3. **Entity-action clarity** - Identify what things (entities) are involved and what happens to them (actions). Explore how these entities are used today before designing new capabilities.

4. **Workflow impact** - New features change existing flows. Always explore how current workflows will be affected.

5. **Assumption surfacing** - Make implicit decisions explicit. What are they assuming exists? What are they assuming users know?

**Use the questioning skill to question effectively.**

---

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: RAW DUMP                                              │
│                                                                 │
│  1. Ask "What do you want to build?" (freeform)                 │
│  2. Understand the problem and WHY they're solving it           │
│  (Don't expect full entities/workflows yet - just the idea)     │
│                                                                 │
│  PHASE 2: PRODUCT QUESTIONING                                   │
│                                                                 │
│  3. Use the questioning skill to dig into every response        │
│  4. Challenge vagueness, surface assumptions                    │
│  5. Make abstract concepts concrete                             │
│  6. OUTPUT: Entity-Action mapping                               │
│                                                                 │
│  PHASE 3: DEEP QUESTIONING (Codebase Exploration)               │
│                                                                 │
│  7. Explore codebase → how are entities used today?             │
│  8. Question: how will current workflows change?                │
│  9. Handle: unknown entities, third-party integrations          │
│                                                                 │
│  PHASE 4: DECISION GATE                                         │
│                                                                 │
│  10. When ready → ask "Create requirement document?"            │
│  11. If gaps remain → continue questioning                      │
│                                                                 │
│  PHASE 5: DOCUMENT GENERATION                                   │
│                                                                 │
│  12. Generate requirements/<feature>-requirement-document.md    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Raw Dump

**Goal**: Get the initial idea. Understand the problem and why they're solving it. Don't expect complete entities or workflows yet.

### Step 1: Open the Conversation

Display the stage banner and ask an open-ended question:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PRD ► DISCOVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What do you want to build?

Tell me about the feature, problem you're solving, or capability you need.
```

**WAIT for their response.** Do NOT ask structured questions yet. Let them dump their mental model freely.

### Step 2: Capture the Problem Space

Listen for:
- **The problem**: What pain or need sparked this?
- **The why**: Why is this important now?
- **Initial hints of entities**: Things they mention (users, vendors, products, etc.)

At this stage, you're just absorbing. Don't try to structure yet.

---

## Phase 2: Product Questioning

**Goal**: Through deep questioning, arrive at a clear Entity-Action mapping. Use the questioning skill throughout this phase.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PRD ► PRODUCT QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 3: Follow Threads and Challenge Vagueness

Use the techniques in the questioning skill:
- **Challenge vagueness**: "What does 'easily' mean?"
- **Make abstract concrete**: "Walk me through what happens"
- **Surface assumptions**: "You're assuming X exists - is that true?"
- **Find boundaries**: "What's NOT included in this?"

### Step 4: Build Entity-Action Mapping

As clarity emerges, build the mapping:

```
## Entity-Action Mapping

### Entity 1: Vendor
- **Action 1**: Add vendor (to tour group)
- **Action 2**: Modify vendor details
- **Action 3**: Remove vendor

### Entity 2: Tour Group
- **Action 1**: Associate vendor
- **Action 2**: View associated vendors

### Entity 3: [New entity from discussion]
- **Action 1**: ...
```

### Step 5: Present and Confirm

```
Based on our discussion, here are the entities and actions involved:

**Vendor**
- Add vendor to tour group
- Modify vendor details

**Tour Group**
- Associate/disassociate vendors
- View vendor list

Does this capture everything? Any entities or actions missing?
```

**WAIT for confirmation before proceeding to Phase 3.**

---

## Phase 3: Deep Questioning (Codebase Exploration)

**Goal**: For each entity from Phase 2, explore how it's currently used in the codebase and deeply question how workflows will change.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PRD ► DEEP QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 6: Explore the Codebase

For each entity in your Entity-Action mapping, spawn an exploration agent:

```
Task tool:
  subagent_type: implementation-researcher
  prompt: |
    I need to understand how this entity is used in the codebase:
    
    Entity: [entity name]
    Actions user wants: [list of actions from Phase 2]
    
    Find:
    1. Where is this entity defined (types, database schema)?
    2. What UI components currently display or modify this entity?
    3. What APIs/services operate on this entity?
    4. What actions are ALREADY possible on this entity?
    5. Are any of the requested actions already implemented?
    
    Return a summary of current usage patterns.
```

### Step 7: Question Workflow Changes

Based on codebase findings, question how things change:

```
I found that [Entity] is currently used in these places:
- [Location 1]: [what happens there]
- [Location 2]: [what happens there]

The action "[action]" you want already exists / doesn't exist.

Questions:
1. How should [Location 1] behave differently with this change?
2. Should [Location 2] also be affected, or should it stay the same?
3. If it should stay the same, how do we ensure it's not impacted?
```

**WAIT for responses. Use `questioning.md` techniques to dig deeper.**

### Step 8: Handle Special Cases

During exploration, you may encounter these scenarios:

#### Case 1: Unknown Entity

If the user mentions an entity you don't recognize (e.g., "combo"):

```
You mentioned "[entity]". I don't see this as a distinct entity in the codebase.

Questions:
1. Is this a new type of an existing entity? 
   (e.g., is a "combo" a type of "tour group" or "product"?)
2. How do you define this entity?
3. What makes it different from [similar existing entity]?
4. Should it share behavior with [existing entity] or be completely separate?
```

#### Case 2: Third-Party Integrations

If the feature involves third-party systems:

```
This feature involves integration with [third-party system].

Questions:
1. How does this integration currently work?
2. What data flows between our system and [third-party]?
3. Will this feature require changes to the integration?
4. If we can't change the integration, can this feature still work?
5. Should we consider NOT including this integration in v1?
```

**Important**: If the integration is complex and unclear, suggest scoping it out:

```
The [third-party] integration adds significant complexity. 

Options:
- Include it (requires [X, Y, Z] to be figured out)
- Exclude it from v1 (build the core feature first, add integration later)
- Find a workaround (manual process instead of automated integration)

What's your preference?
```

### Step 9: Confirm Workflow Impact

Present a summary of how current workflows will change:

```
## Workflow Impact Summary

### [Workflow 1: e.g., "Adding a vendor"]
**Before**: [How it works today]
**After**: [How it will work with this feature]
**Impact**: [What changes for users]

### [Workflow 2]
**Before**: ...
**After**: ...
**Impact**: ...

### Unchanged Workflows
These should NOT be affected:
- [Workflow that stays the same]
- [Another workflow]

Does this accurately capture how things will change?
```

**WAIT for confirmation before proceeding to Decision Gate.**

---

## Phase 4: Decision Gate

### Step 9: Check Readiness

When you believe you have enough detail, ask:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PRD ► READY CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I think I have a clear picture of what you want to build:

**Summary**:
[2-3 sentence summary of the feature]

**Key decisions made**:
- [Decision 1]
- [Decision 2]

**Entities involved**: [list]
**Actions supported**: [list]

Ready to create the requirement document?

- **Create document** — I'm ready, let's generate it
- **Keep exploring** — I want to add more / ask me more questions
```

**If "Keep exploring"**: Ask what they want to add, or identify gaps and probe.

**If "Create document"**: Proceed to Phase 5.

---

## Phase 5: Document Generation

### Step 10: Generate Requirement Document

Create a comprehensive requirement document:

```
Write file: requirements/<feature-name>-requirement-document.md
```

**Do not compress. Capture everything gathered.**

**Document structure**:

```markdown
# [Feature Name] - Product Requirement Document

## Problem Statement
[Why does this need to exist? What pain are we solving?]

## Goals
- [Goal 1]
- [Goal 2]

## Non-Goals (Out of Scope)
- [What this feature will NOT do]

## User Personas
| Persona | Description | Primary use case |
|---------|-------------|------------------|
| [Type] | [Who they are] | [What they do] |

## Entities & Actions

### [Entity 1]
**Current state**: [How it's used today]
**New actions**: 
- [Action 1]: [Description]
- [Action 2]: [Description]

### [Entity 2]
...

## User Stories

### US-1: [Story title]
**As a** [persona]
**I want to** [action]
**So that** [outcome]

**Acceptance Criteria**:
- [ ] [Criterion 1]
- [ ] [Criterion 2]

### US-2: [Story title]
...

## Workflow Changes

### [Existing workflow 1]
**Before**: [How it works today]
**After**: [How it will work with this feature]

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| [Edge case 1] | [What happens] |
| [Error case 1] | [How we handle it] |

## Dependencies
- [Dependency 1]
- [Dependency 2]

## Success Metrics
- [Metric 1]: [How we measure]
- [Metric 2]: [How we measure]

## Open Questions
- [Any unresolved questions flagged during discussion]
```

---

## Subagent Reference

| Subagent | When to Spawn | What It Returns |
|----------|---------------|-----------------|
| `implementation-researcher` | Phase 2 - Entity analysis | Current entity usage in codebase |

---

## Anti-patterns

| Anti-Pattern | What It Looks Like | Do This Instead |
|--------------|-------------------|-----------------|
| **Shallow acceptance** | Taking "it should be easy" without probing | Ask "easy how? Fewer clicks? Faster? Less confusing?" |
| **Checklist walking** | Going through domains regardless of what they said | Follow their thread, not your list |
| **Corporate speak** | "What are your success criteria?" | "How will you know this worked?" |
| **Interrogation** | Firing questions without building on answers | Acknowledge their answer, then dig deeper |
| **Rushing** | Minimizing questions to get to "the work" | The questioning IS the work |
| **Skipping codebase exploration** | Designing without checking current usage | Always explore how entities are used today |
| **Ignoring workflow impacts** | Not asking how existing flows change | "How does this affect [current behavior]?" |
| **Assuming understanding** | Moving on without confirming | Repeat back what you heard, verify |

---

## Output

At the end of this workflow, you produce:
1. A comprehensive `requirements/<feature-name>-requirement-document.md`
2. Clear entity-action mappings
3. Documented workflow changes
4. User stories with acceptance criteria
5. Edge cases and error handling defined
