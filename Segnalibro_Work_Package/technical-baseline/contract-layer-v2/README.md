# Segnalibro — contract layer v2

This bundle freezes the API boundary between PostgreSQL/Supabase and SvelteKit.
It is the final infrastructure step before implementing the actual UI.

## Included

```text
supabase/migrations/
  003_rpc_contract_alignment.sql

src/lib/contracts/
  primitives.ts
  enums.ts
  themes.ts
  books.ts
  readings.ts
  reviews.ts
  stats.ts
  rpc.ts

src/lib/data/
  errors.ts
  rpc-client.ts
  rpc-names.ts
  repositories.ts
  example-library-repository.ts

src/lib/themes/
  segnalibro.ts
  to-css.ts

tests/contracts/
  unit.contracts.test.ts
  db.contracts.test.ts

tests/helpers/
  env.ts
  fixture.ts
  rpc.ts

docs/
  RPC_CONTRACTS.md
  ARCHITECTURE_RULES.md
  CONTRACT_TESTING.md
```

## Migration 003

`003_rpc_contract_alignment.sql` sits after the previously designed schema and
RPC migration.

Migration 002's transactional operations are deliberately moved into the
private schema and retained as implementation details. Public RPCs become
versioned wrappers that return only the documented contract.

This lets us improve internal SQL later without coupling the frontend to table
names or raw query shapes.

All public responses use:

```ts
{
  contractVersion: 1,
  ...
}
```

## Important contract decisions frozen here

### `BookSummary` is universal

Home, shelves, queue, Genre View, Bingo, DNF and other read models all reuse one
book representation. This prevents each page inventing a slightly different
book type.

### `bigint` catalog IDs are strings

JavaScript UUIDs remain UUID strings; PostgreSQL bigint IDs are serialized as
strings so no future catalog size can cause JS precision loss.

### Null/array semantics

Server responses obey:

- known missing scalar/object: `null`;
- empty collection: `[]`;
- never silently omit a documented response property.

### Queue soft limit is explicit

`queue_add` returns:

```ts
status: 'added' | 'alreadyQueued' | 'requiresConfirmation'
```

plus `currentCount`, `position`, and the current queue. The UI therefore does
not infer business state from errors.

### DNF is idempotent too

`mark_dnf`, like progress and finish, takes a client-generated event UUID. It
is safe to queue offline and retry.

### Corrections preserve activity history better

A page correction with no explicit `localDate` is attributed to the latest
real activity date for that reading instead of to the day the typo happened to
be corrected. This reduces distortion in calendar/year statistics.

### Bingo assignment is a domain operation

`assign_bingo_book` only accepts a book with at least one completed reading.
The database, not the component, enforces the rule.

### Themes remain token-based

The DB stores the selected built-in key or an owned custom-theme ID. Built-in
color definitions remain in source code and UI components still never contain
literal colors.

## Commands

```bash
npm install
npm run typecheck
npm run test:contracts
```

For real DB/RPC tests:

```bash
supabase start
supabase db reset
# export keys from `supabase status`
npm run test:contracts:db
```

See `docs/CONTRACT_TESTING.md`.
