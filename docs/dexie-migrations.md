# Dexie migration strategy (ExpendDB)

Current version: **2** (`transactions: '++id, date, createdAt'`, `chatMessages: '++id, role, createdAt'`).

1. Never edit an existing `db.version(N).stores(...)` block in `src/db/db.ts`.
2. Schema changes are additive: append `db.version(N+1).stores({...full new schema...})`
   with an `upgrade()` callback that migrates old rows to the new shape.
3. `tests/unit/db.test.ts` must be updated in the same commit: bump the
   `db.verno` assertion and add a test that writes data in the old shape
   and reads it back in the new shape.
4. Verify with `npm run test:unit` (fake-indexeddb) plus a manual upgrade
   check on a device or profile holding v2 data before release.
