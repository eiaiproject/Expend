# Product

## Register

product

## Users

Privacy-conscious individuals tracking personal expenses and debts. Want fast, offline-first finance management without accounts, cloud sync, or ads. Use on desktop and mobile; value speed and data ownership over flashy features.

## Product Purpose

Local-first PWA expense tracker. Record spending, manage wallets, track debts, monitor budgets, view statistics. All data in IndexedDB — never leaves the device unless the user explicitly exports it. Success = user opens app, logs expense in <5 seconds, trusts their data is safe.

## Brand Personality

Simple, quick, precise. No clutter, no ceremony. The app feels like a well-made tool — reliable, fast, invisible when doing its job.

## Anti-references

Banking apps: overwhelming dashboards, promotional banners, upsell flows, dense data tables, complex navigation hierarchies. Expend should feel lighter, faster, and simpler than any banking app.

## Design Principles

1. **Speed first**: Every interaction should feel instant. No loading screens for local data, no unnecessary confirmations, no friction between intent and action.
2. **Privacy by default**: No accounts, no cloud, no tracking. The user owns their data completely. This is a feature, not a limitation.
3. **Offline-capable**: Full functionality without internet. The app works anywhere, anytime — on a plane, in a basement, in a dead zone.
4. **Progressive disclosure**: Show what's needed now, hide the rest. New users see expense entry; power users discover budgets, debts, and exports. Destructive or advanced actions live behind secondary menus or confirmation dialogs.
5. **Quiet confidence**: The interface stays out of the way. No visual noise, no decorative elements that don't serve a purpose.

## Accessibility & Inclusion

WCAG AA compliance. Keyboard navigation throughout. Reduced motion support (prefers-reduced-motion respected). High contrast mode available. Screen reader friendly with proper ARIA labels and semantic HTML.

## Functional Areas

### Transactions

- Quick Add: expense saved in seconds from the central Add action in the bottom nav; progressive disclosure keeps secondary fields (description, wallet, category, notes) behind an "Add details" toggle.
- Suggestions: recent payees rank by frequency/recency, category suggestion follows the payee.
- Templates: reusable transaction templates (name, amount, category, wallet, notes) fill the form in one tap.
- Default wallet: configurable; falls back to last-used, then first valid wallet.
- Edit and delete are atomic: transfers roll back both wallets on edit/delete; undo restores deleted transactions including transfer pairs.
- Unsaved edits are protected: closing a dirty form asks for confirmation.

### Wallets

- Multi-wallet balances, transfers, reconciliation (balance adjustment), archive.
- Deleting a wallet with transactions is blocked; deleting an empty one warns and removes it.

### Payees & Merchants

- Automatic payee grouping from transaction descriptions, rename (merge), favorites, and a dedicated Payees view with quick-add from any payee.

### Debts

- Payables and receivables, partial payments, write-offs, archive, due-date reminders, and an Upcoming section that merges debt due dates with recurring schedules.

### Recurring Transactions

- Weekly/biweekly/monthly/yearly schedules, create or remind modes, end dates.
- Occurrences are processed on app open with duplicate prevention; a missed occurrence is created exactly once. See README "Recurring Transaction Limitations".

### Budgets & Insights

- Monthly category budgets with near-limit/over alerts.
- Up to three actionable insights on Home: category increase vs last month, month-over-month spending, top payee, budget exhaustion projection (labeled as an estimate), stale wallet, debt due, recurring amount increase. Every insight drills down to its source view and can be dismissed; privacy mode hides derived percentages.

### Data Safety

- Full JSON backup with metadata, status card, and non-blocking reminders (first 10 transactions, >30 days stale, >50 changes).
- Restore flow: file validation → preview → replace → reopen; a pre-import snapshot backs the CSV import, and a failed high-impact import rolls back automatically.
- CSV wizard: preview, row validation with failure reasons, duplicate detection via transaction fingerprint (skip or import anyway), error report download, spreadsheet formula-injection guard.

### Support

- Optional, non-intrusive Trakteer support: permanent links in Settings → About, plus a dismissible contextual prompt gated by meaningful-use milestones and a 60-day cooldown. No financial data ever leaves the device or appears in external links.

## Key Limitations

- Data is local to the browser profile: clearing site storage deletes it.
- PIN lock guards casual access only; it does not encrypt IndexedDB data.
- CSV is for transaction portability and spreadsheets; JSON is the full backup format.
- Recurring schedules process on app open (see README for details).

## Measurement

Local-only, optional product measurement is considered per master.md §12 but is not implemented; the privacy cost was judged not to justify the insight, and the decision is documented in the implementation plan.
