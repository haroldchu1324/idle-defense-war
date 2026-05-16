Always create a backup of index.html as index_backup.html before making any edits to it. Overwrite the previous backup each time.
## Formula Source of Truth

- Client-side formula is ALWAYS the source of truth
- NEVER modify client-side formula logic
- If server/SQL formula differs from client-side, the SQL must be updated to match client-side — not the other way around
- If a formula exists on client-side but not in SQL, create it in SQL to match exactly
- Do NOT change any formula, calculation, or business logic unless explicitly asked

## Do Not Touch (unless explicitly asked)
- Any existing SQL formulas or calculated fields
- Any client-side calculation logic
- [add specific file names here, e.g. `src/utils/calculations.ts`, `queries/formulas.sql`]