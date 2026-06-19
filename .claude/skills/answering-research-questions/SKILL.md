---
name: answering-research-questions
description: Search the codebase to find existing implementations, APIs, components, and patterns. Use when validating assumptions or answering "does X exist?" questions.
---

# Skill: Answering Research Questions

## Purpose

Search the codebase to answer research questions generated from the formulate-approach step. Find existing implementations, reusable components, APIs, and patterns.

## Inputs

- Research questions
- Context about what you're looking for (component, API, schema, logic)

## Search Strategies

### UI Components

**Approach: Top-down (Screen → Section → Component)**

1. **Start with the screen/page**
   - Search for the page/tab name mentioned in the requirement or ask the user about it if you cannot find it or if it's not given to you
   - Look in `client/src/components/` or `client/src/pages/`
   - Example: "Proposed Assortment tab" → search for `ProposedAssortment`

2. **Navigate to the section**
   - Once you find the screen, read it to understand its structure
   - Find the section where the component should live

3. **Search for the component type**
   - If looking for a badge → grep for `Badge`, check `components/ui/badge.tsx`
   - If looking for a dropdown → grep for `Select` or `Dropdown`, check `components/ui/`
   - If looking for a dialog → grep for `Dialog`, check for existing dialogs in the feature

**Fallback strategies:**
- Grep for strings visible in the UI (button text, labels, titles)
- Use file naming conventions: `*Dialog.tsx`, `*Tab.tsx`, `*Card.tsx`
- Search across the codebase if feature-specific search fails

```
# Find all dialogs in a feature
Glob: **/mmp/components/*Dialog.tsx

# Find component by visible text
Grep: "Add Experience" in client/src/

# Find all components of a type
Grep: "export.*Badge" in client/src/components/
```

### Backend APIs

**Approach: Routes → Service → Response**

1. **Search routes first**
   - Look in `src/features/*/routes/*.routes.ts`
   - Grep for the resource name or action
   - Example: Looking for experience categories → grep for `categories` in routes

2. **Find the service**
   - Routes call services in `src/features/*/services/*.service.ts`
   - Read the service to understand the logic and response shape

3. **Check the response type**
   - Look in `src/features/*/types/` for response interfaces
   - Understand what data the API returns

```
# Find routes for a resource
Grep: "categories" in src/features/*/routes/

# Find service methods
Grep: "getCategories" in src/features/*/services/

# Find response types
Glob: **/types/**/responses/*.ts
```

### Database Schema

**Approach: Schema definitions → Migrations**

1. **Check schema definitions**
   - Look in `database/init/` for SQL files
   - Files are numbered: `01-create-enums.sql`, `02-create-tables.sql`, etc.
   - Also check Drizzle schemas in `src/database/*/schema/`

2. **Review migrations**
   - Later numbered files contain schema changes
   - Example: `08-add-combo-support.sql` adds combo-related columns

```
# Find table definitions
Grep: "CREATE TABLE.*experience" in database/init/

# Find column definitions
Grep: "category" in database/init/

# Find Drizzle schema
Glob: **/schema/*.schema.ts
```

### Business Logic

**Approach: Service → Utils → Gateway**

1. **Services contain business logic**
   - Look in `src/features/*/services/*.service.ts`
   - This is where most business rules are implemented

2. **Utils for helper functions**
   - Check `src/features/*/utils/` for shared utilities

3. **Gateway for external calls**
   - Check `src/features/*/gateway/` for external API integrations

```
# Find business logic for a feature
Read: src/features/mmp-builder/services/mmp.service.ts

# Find utility functions
Grep: "formatCategory" in src/features/*/utils/
```

## Answer Format

For each question, provide:

1. **Answer**: Direct answer to the question
2. **Evidence**: File paths and relevant code snippets
3. **Reusability assessment**: Can this be reused? Extended? Or need new?

See `EXAMPLES.md` for complete examples.

## When You're Stuck

If you cannot find what you're looking for after trying the strategies above:

1. **Broaden your search** - Remove specific terms, search for related concepts
2. **Check imports** - If you found a related file, check what it imports
3. **Ask the user** - Describe what you searched for and what you found. Ask for guidance:
   > "I searched for X in routes/ and services/ but couldn't find an API for categories. I found Y which is related. Should I extend Y or is there another location I should check?"

## Anti-patterns

- **Giving up too early** - Try multiple search strategies before concluding something doesn't exist
- **Not reading context** - Finding a file but not reading it to understand its purpose
- **Assuming from names** - A file named `categories.ts` might not be what you need; read it
- **Missing related code** - Finding a component but not checking how/where it's used
