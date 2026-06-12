# Database Migrations

Expend stores local data in IndexedDB database `ExpendDB` through Dexie. This document summarizes the schema history and the native preflight repair that runs before Dexie opens the database.

## Current Stores

- `wallets`: wallet metadata and cached `currentBalance`.
- `categories`: category name, icon, color, and optional budget.
- `transactions`: expenses, balance adjustments, and transfer records.
- `debts`: payable and receivable records.
- `debtPayments`: debt/receivable cashflow history.
- `settings`: language, theme, security, lockout, and migration flags.

## Migration Matrix

| Version | Area | Schema / Data Change | Notes |
|---|---|---|---|
| Native 100 preflight | Debt repair | Detects legacy `debt_payments`, rewrites `debts` and `debtPayments`, and removes `debt_payments`. | Runs through native IndexedDB before Dexie open because a legacy release reused an incompatible Dexie schema version. |
| Dexie 3 | Transfers | Adds `transferGroupId` to `transactions`; backfills likely transfer pairs. | Marks `migration_completed_v3` or `migration_failed_v3` in `settings`. |
| Dexie 4 | Performance | Adds compound indexes `[type+date]`, `[walletId+date]`, and `[categoryId+date]`. | Supports faster filtered reads. |
| Dexie 5 | Date normalization | Normalizes transaction dates from ISO timestamp strings to `YYYY-MM-DD`. | Only updates rows containing `T` in `date`. |
| Dexie 6 | Categories | Deduplicates categories by normalized name and assigns curated colors to categories missing a color. | Marks `categories_deduplicated` and `category_colors_migrated`. |
| Dexie 7 | Wallet balances | Computes `currentBalance` for each wallet from initial balance and transaction history. | Marks `wallet_balance_computed`; records failure as `migration_failed_v7`. |
| Dexie 8 | Debt feature | Adds `debts` and `debtPayments` stores. | Native preflight protects incompatible legacy debt schemas before this version runs. |
| Dexie 9 | Debt compatibility | Reserves a compatibility step for v1.2.1 debt repair. | No data transform in current source. |
| Dexie 10 | Current debt schema | Keeps current wallet/category/transaction/debt/payment/settings schema. | Current schema version at the time of this document. |

## Testing Guidance

- Keep `tests/e2e/debt-migration.spec.ts` green for legacy debt paths.
- Add a targeted migration fixture whenever a Dexie version adds, removes, or rewrites a store/index.
- For migrations that recompute money values, assert both row shape and wallet balance results.
- For native preflight repair changes, test with an actual IndexedDB version lower than `100` containing the legacy store names.

## Change Checklist

When changing `src/db/db.ts` migrations:

1. Add a new Dexie version instead of mutating historical versions unless the release has not shipped.
2. Keep migration flags in `settings` specific to the version.
3. Avoid deleting user data unless the migration has a deterministic rewrite path.
4. Update this matrix and the related E2E/unit fixtures in the same change.
5. Validate export/import after the migration because backups should remain compatible across schema updates.
