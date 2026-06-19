# Examples: Answering Research Questions

## API Endpoint Question

**Question**: "Is there an API endpoint that returns experience categories?"

**Answer**: Yes, there is a `GET /mmp/:mmpId/categories` endpoint.

**Evidence**:
- Route: `src/features/mmp-builder/routes/mmp.routes.ts:45`
- Service: `src/features/mmp-builder/services/mmp.service.ts:120`
- Returns: `{ categories: Array<{ id: string, name: string }> }`

**Reusability**: Can be reused directly. Response shape matches what we need.

---

## UI Component Question

**Question**: "Where is the Add Experience dialog?"

**Answer**: Found at `AddNewExperienceDialog.tsx`

**Evidence**:
- File: `mmp-builder/client/src/components/mmp/tabs/ProposedAssortmentTab/ZoomedOut/AddNewExperienceDialog.tsx`
- Used in: `TableRows.tsx`
- Props: `{ isOpen, onClose, onSubmit, tourGroupId }`

**Reusability**: Need to extend this component to add the category dropdown.

---

## Database Schema Question

**Question**: "What is the schema for tour groups? Can I add a category column?"

**Answer**: Tour groups are stored in `mmp_tour_group` table.

**Evidence**:
- Schema: `database/init/03-create-mmp-tables.sql:45-60`
- Drizzle: `src/database/postgres/schema/mmp.schema.ts:78`
- Current columns: `id`, `name`, `mmp_id`, `tour_group_type`, `created_at`

**Reusability**: Can add a new column. Need migration file `09-add-category-to-tour-group.sql`.

---

## Business Logic Question

**Question**: "How does the system determine if a tour group is a combo?"

**Answer**: Combo status is determined by the `tour_group_type` enum column.

**Evidence**:
- Enum: `database/init/08-add-combo-support.sql` defines `TOUR_GROUP_TYPE` with values `STANDARD`, `COMBO`
- Service: `src/features/mmp-builder/services/mmp.service.ts:340` checks `tourGroupType === 'COMBO'`
- Used in: API response mapping at `mmp.utils.ts:89`

**Reusability**: Pattern exists. Follow same approach for new type distinctions.
