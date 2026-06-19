---
name: user-story
description: Guidelines for writing user stories from requirement documents. Use when generating user stories, documenting user flows, or translating PRDs into action-based narratives.
---

# User Story Writing

User stories describe features as sequences of user actions and outcomes—no implementation details.

## When to Use

- Generating user stories from a requirement document
- Documenting user flows for a new feature
- Translating PRDs into action-based narratives
- Identifying open questions about UX/copy/design

## Principles

- **ACTION → OBSERVATION pattern**: Each interaction is two bullets: what the user does, then what the user sees
- **No implementation details**: No APIs, types, file paths, database columns, or backend logic
- **Base on real UI**: Explore the codebase to ensure screens, buttons, and flows are realistic
- **User-facing questions**: Open questions concern copy, design, behavior, or existing actions that may be affected but not addressed in the requirements

## ACTION → OBSERVATION Pattern

Every user interaction follows this cycle:

| Type | Prefix | Examples |
|------|--------|----------|
| **ACTION** | "User taps...", "User clicks...", "User enters...", "User selects..." | User taps the **Add Experience** button. |
| **OBSERVATION** | "User sees...", "Dialog shows...", "Screen updates to show...", "User is shown..." | User sees the Add New Experience dialog. |

Always pair an action with its resulting observation. Never skip what the user sees after an action.

## Workflow

| Step | Action |
|------|--------|
| 1 | Identify the requirement document from `requirements/` |
| 2 | Extract requirements and build a mental model of the feature |
| 3 | Identify affected components (screens, tabs, dialogs) mentioned in the requirements |
| 4 | Catalog all user actions in those components (buttons, forms, selections, flows) |
| 5 | Cross-check: do any existing actions interact with or conflict with the requirements? |
| 6 | Write user stories as bulleted sequences of user actions and outcomes |
| 7 | Add open questions for: copy/design gaps, and any existing actions affected but not addressed |
| 8 | Save to `requirements/<feature-name>-user-stories.md` |

## Output Format

```markdown
# <Feature Name> – User Stories

**Source:** [<requirement-doc-name>](./<requirement-doc-name>)  
**Generated:** <date>

<Brief one-line description from user's perspective.>

---

## User Story 1 – <Short title>

- **ACTION**: User taps X button.
- **OBSERVATION**: User sees Y dialog.
- **ACTION**: User selects Z option.
- **OBSERVATION**: User sees the form update with new fields.
- **ACTION**: User clicks Save.
- **OBSERVATION**: User sees a success message and the updated list.

---

## Open Questions

1. <Question about copy, design, or user flow>
2. <Existing action that may be affected but is not addressed in requirements>
```

## Example

```markdown
## User Story 1 – Adding a new combo product to the assortment

- **ACTION**: User taps the **Add Experience** button.
- **OBSERVATION**: User sees the Add New Experience dialog with two options: Create New Experience and Add Existing Experience.
- **ACTION**: User selects the **Create New Experience** radio button.
- **OBSERVATION**: User sees a Subcategory dropdown appear below the mode selection.
- **ACTION**: User selects the **Combos** subcategory from the dropdown.
- **OBSERVATION**: User sees the dialog update—SP URL, OTA URL, and variant fields are hidden; only Subcategory, Experience name, and an info message are shown.
- **ACTION**: User enters the experience name.
- **OBSERVATION**: User sees the name appear in the input field.
- **ACTION**: User clicks **Add Assortment**.
- **OBSERVATION**: User sees the dialog close and the new product appear in the Proposed Assortment list with a **Combo** tag.
```
