You are a senior product engineer, UX architect, data-integrity specialist, and accessibility reviewer working directly on the Expend repository.

Your task is to audit, plan, implement, test, and document a coordinated optimization of Expend, a privacy-first, local-first personal finance PWA.

Work autonomously. Do not ask for confirmation between normal implementation steps. Inspect the repository before making assumptions. If the actual implementation differs from this specification, preserve the intended product behavior and adapt the technical approach to the current architecture.

Do not attempt to implement every roadmap item blindly. First establish the current state, identify what already exists, then execute the work in safe, reviewable phases.

===============================================================================
1. PRODUCT CONTEXT
===============================================================================

Expend is a local-first personal finance PWA built around these principles:

- Fast expense entry
- No account required
- No cloud dependency
- No advertising or tracking
- Offline-capable
- User-owned financial data
- Simple, precise, low-friction interface
- Progressive disclosure for advanced functionality
- English and Indonesian localization
- WCAG AA accessibility

The application currently includes, or may include:

- Expense transactions
- Wallet management
- Transfers between wallets
- Balance adjustments and reconciliation
- Categories and category budgets
- Debts and receivables
- Partial debt payments
- Payee or merchant grouping
- Statistics and reports
- Search, filter, and sorting
- JSON backup and restore
- CSV import and export
- PIN-based application lock
- Privacy mode for hiding amounts
- PWA installation and offline support
- Responsive bottom navigation and desktop sidebar
- Bottom sheets, dialogs, toasts, and onboarding

The current product is feature-rich, but the next optimization should prioritize:

1. Data safety and user trust
2. Faster daily transaction entry
3. Payee reuse as a transaction shortcut
4. Better recurring transaction and reminder support
5. UI simplification through progressive disclosure
6. More visible but non-intrusive Trakteer support
7. Actionable insights instead of chart-only reporting
8. Stronger import, restore, and error recovery

===============================================================================
2. GLOBAL OPERATING RULES
===============================================================================

Follow these rules throughout the work.

2.1 Repository-first execution

Before editing:

- Read PRODUCT.md, README.md, CHANGELOG.md, package.json, database schema, migrations, services, views, components, locale files, tests, PWA configuration, and current routing.
- Inspect the actual navigation structure.
- Inspect existing backup, restore, import, export, transaction, transfer, payee, debt, settings, security, and statistics implementations.
- Search for existing feature flags, storage keys, analytics-like metadata, support links, and Trakteer references.
- Identify all relevant tests before modifying business rules.
- Do not infer file names or APIs when they can be discovered from the repository.

2.2 Preserve local-first principles

- Do not add mandatory accounts.
- Do not add cloud analytics.
- Do not send transaction data to external services.
- Do not introduce hidden network dependencies.
- Do not record amounts, descriptions, payee names, wallet names, notes, debts, or other financial data in telemetry.
- Any product-usage measurement must be optional, local-only, and resettable.
- External support links may open Trakteer, but no financial application data may be included in the URL.

2.3 Data integrity

Financial operations must be atomic whenever multiple records or balances are affected.

Never allow:

- Half-created transfers
- Orphaned transfer pairs
- Partial restores
- Duplicate recurring transactions caused by retries
- Debt payments exceeding the remaining amount
- Incorrect wallet balance rollback
- Import records that reference missing required entities
- Schema migration that silently discards data

Use database transactions where supported.

2.4 Progressive disclosure

Keep frequent actions visible and move administrative actions into secondary menus.

Frequent actions include:

- Add expense
- Select a frequently used payee
- View recent transactions
- Transfer money
- Record a debt payment
- Create a backup

Administrative actions include:

- Merge payees
- Archive or restore entities
- Write off a debt
- Reconcile a wallet
- Bulk delete
- Granular payee filters
- Advanced import behavior
- Detailed auto-lock timing

2.5 Accessibility

All new and modified flows must support:

- Keyboard-only operation
- Screen reader labels
- Semantic HTML
- Focus trapping where appropriate
- Focus restoration
- Accessible validation messages
- Error announcement
- Reduced motion
- High contrast
- 200 percent text zoom
- Minimum 44 by 44 pixel touch targets
- Mobile widths of 320, 360, 375, 390, and 414 pixels

2.6 Localization

- Add every user-facing string to both English and Indonesian locale files.
- Do not hard-code production UI copy.
- Preserve locale-aware currency and date formatting.
- Internal identifiers may remain in English.
- The Indonesian user-facing term should preferably be "Penerima & Merchant".
- Internal code may continue using "payee" if that is the established domain term.

2.7 Quality gates

After each coherent phase, run the relevant repository commands, including where available:

- Strict lint
- Type checking
- Localization key validation
- Unit tests
- Production build
- Chromium E2E tests
- Critical-path Firefox or WebKit smoke tests

Do not declare a phase complete if tests fail because of the changes.

If a pre-existing failure is discovered:

- Verify it is pre-existing.
- Document it clearly.
- Do not hide it.
- Continue only if it does not invalidate the changed behavior.

===============================================================================
3. INITIAL AUDIT AND IMPLEMENTATION PLAN
===============================================================================

Before implementation, create a concise repository-based audit.

The audit must identify:

- Existing features that already satisfy this specification
- Missing features
- Partially implemented features
- Current database entities and schema versions
- Required schema migrations
- Existing business invariants
- Existing backup format and versioning
- Existing Trakteer CTA locations
- Existing support prompt persistence
- Existing payee ranking or aggregation logic
- Current navigation and route exposure
- Current mobile interaction risks
- Current automated test coverage
- Highest-risk changes
- Proposed implementation order

Create a phase checklist in a project planning document or update the existing project plan convention used in the repository.

Each task must include:

- Purpose
- Files or modules likely affected
- Data model impact
- Migration impact
- User-facing behavior
- Accessibility considerations
- Tests required
- Completion status

Do not spend excessive time producing speculative documentation. The plan should be implementation-oriented.

===============================================================================
4. PHASE 1: DATA SAFETY AND USER TRUST
===============================================================================

Objective:

Make backup status visible, restore safer, storage failures understandable, and PIN wording accurate.

4.1 Backup metadata

Add local metadata sufficient to determine:

- Whether a full backup has ever been completed
- Timestamp of the last successful backup
- Backup format version
- Number of relevant data changes since the last backup
- Whether a backup reminder was dismissed or postponed
- Next eligible reminder time

Do not count security-sensitive operations unnecessarily.

Create a centralized mechanism for incrementing the change count after successful mutations, such as:

- Transaction creation, update, or deletion
- Transfer creation, edit, or deletion
- Wallet mutation
- Category mutation
- Debt or receivable mutation
- Debt payment
- Relevant import

Do not increment the counter when an operation rolls back or fails.

4.2 Backup status UI

Create a visible backup status component.

It should communicate states such as:

- Never backed up
- Backed up recently
- Backup recommended
- Many changes since last backup

Show it prominently in Settings.

Consider a smaller Home indicator only when action is recommended. Do not permanently clutter Home when the backup state is healthy.

Primary action:

- Back up now

Secondary actions:

- Restore backup
- Import or export transactions

Clarify that:

- JSON is the full backup format
- CSV is intended for transaction portability and spreadsheet workflows

4.3 Backup reminder rules

Implement centralized, testable reminder rules.

Suggested initial triggers:

- At least 10 transactions and no previous backup
- Last successful backup older than 30 days
- At least 50 relevant changes since the last backup
- Before destructive reset
- Before replace-style restore
- Before a high-risk migration, if the architecture supports this safely

Reminder behavior:

- Non-blocking in normal use
- Can be postponed for 7 days
- Can be dismissed according to product rules
- Never shown on every application launch
- Never shown during transaction failure, restore failure, insufficient balance, or other stressful error states

4.4 Restore safety

Before replacing data:

1. Parse the file safely.
2. Validate backup type.
3. Validate format version.
4. Validate schema and required relations.
5. Display a preview.
6. Create a recoverable snapshot of current data.
7. Perform replacement atomically.
8. Reopen and validate restored data.
9. Roll back or restore the snapshot if validation fails.

Restore preview should include, where available:

- Backup date
- Format version
- Wallet count
- Transaction count
- Category count
- Debt count
- Data date range
- Encryption status

If merge restore is not currently safe, do not implement a fragile merge mode. Keep replace mode and make it recoverable.

4.5 Encrypted backup

If the existing architecture can support it safely within this work, add an optional encrypted backup format.

Requirements:

- Password chosen separately from the application PIN
- Versioned encryption envelope
- Unique salt
- Unique nonce or IV
- Authenticated encryption
- Integrity verification
- No plaintext financial records in metadata
- Clear warning that the password cannot be recovered
- Wrong password must fail safely
- Failed decryption must not alter current data

If secure encrypted backup cannot be completed safely in the current phase, design the format and add a documented implementation task. Do not implement custom or unauthenticated cryptography.

4.6 Storage error taxonomy

Create actionable handling for:

- IndexedDB unavailable
- Private or restricted browsing
- Storage quota exhausted
- Database migration failure
- Aborted database transaction
- Corrupted or unreadable records
- Unsupported backup version
- Invalid import file
- Service worker or application version mismatch

Each error should have:

- Internal error code
- User-facing title
- User-facing explanation
- Recovery action
- Optional safe technical details
- No sensitive financial content in diagnostic output

4.7 PIN wording

Audit security copy.

Prefer:

- "Application lock"
- "Kunci aplikasi"
- "Protects against casual access"

Avoid implying that the PIN encrypts IndexedDB.

Add a concise disclosure that device and browser security still matter.

Phase 1 acceptance criteria:

- Successful backups update the metadata consistently.
- Failed backups do not update the success timestamp.
- Restore failure never leaves partially restored data.
- Users can always see the last successful backup time in Settings.
- Destructive reset warns users about backup.
- PIN copy does not claim database encryption.
- Storage failures provide actionable recovery paths.
- Unit and E2E tests cover critical backup and restore behavior.

===============================================================================
5. PHASE 2: FASTER DAILY TRANSACTION CAPTURE
===============================================================================

Objective:

Allow a simple expense to be recorded with minimal decisions and minimal interaction.

5.1 Quick Add

Implement or refine a progressive Quick Add flow.

Default visible fields:

- Amount
- Category or category suggestion
- Save action

Automatically derive sensible defaults:

- Transaction type: expense
- Date: today
- Wallet: user default or last-used valid wallet
- Payee: optional
- Notes: optional

Place secondary fields behind an action such as:

- Add details
- Tambah detail

Do not remove the full transaction form.

5.2 Default wallet

Allow the user to choose a default expense wallet.

Fallback order:

1. Explicitly configured default wallet
2. Last-used active wallet
3. First valid active wallet
4. Ask the user if no valid wallet exists

Archived or deleted wallets must not remain active defaults.

5.3 Local category suggestions

Use local transaction history to suggest categories.

Suggested precedence:

1. Exact normalized payee match
2. Stored payee alias or merge mapping
3. Similar recent description, if a safe existing mechanism exists
4. Last category used for the selected payee
5. Last selected category
6. General default category

The suggestion must remain visibly editable.

Never silently override a category the user selected manually.

5.4 Transaction templates

Add reusable transaction templates if they do not already exist.

A template may include:

- Template name
- Optional amount
- Category
- Wallet
- Payee
- Notes

Show only a small number of the most useful templates in the primary UI.

Handle invalid template references gracefully if a wallet, category, or payee is archived or removed.

5.5 Repeat transaction

Ensure repeat creates a new valid transaction rather than copying unsafe identifiers.

Never copy:

- Database primary ID
- Transfer group ID
- Migration metadata
- Creation timestamps that should be regenerated

For repeated transfers:

- Require valid source and destination wallets
- Create a new transfer pair
- Validate balance
- Create both sides atomically

5.6 Atomic transfer editing

Implement safe editing of an existing transfer.

The operation must:

1. Locate both sides using the canonical transfer group identifier.
2. Validate that the pair is complete.
3. Reverse the previous balance effects logically.
4. Validate the proposed source and destination.
5. Validate sufficient balance after considering reversal.
6. Update both records.
7. Apply the new balance effects.
8. Commit all changes atomically.
9. Roll back everything on failure.

Support changes to:

- Amount
- Date
- Source wallet
- Destination wallet
- Notes or description

Prevent transfer to the same wallet.

Add invariant tests for:

- Pair creation
- Pair editing
- Pair deletion
- Balance rollback
- Failure rollback
- Legacy incomplete pair handling

Phase 2 acceptance criteria:

- A simple expense can be completed with minimal visible fields.
- User-entered category choices are never overwritten.
- Invalid defaults recover gracefully.
- Repeated transfers create new valid pairs.
- Edited transfers never become orphaned.
- All balance changes are correct and atomic.
- Mobile forms remain accessible and usable at supported widths.

===============================================================================
6. PHASE 3: PAYEE REUSE AND PAYEE MANAGEMENT
===============================================================================

Objective:

Transform Payees from an administrative list into a high-value shortcut for repeated transactions.

6.1 User-facing terminology

Use concise, understandable wording.

Recommended Indonesian page title:

- Penerima & Merchant

Recommended English page title:

- Payees & Merchants

Field copy may use context-specific wording.

Do not perform unnecessary internal renaming if the codebase consistently uses "payee".

6.2 Frequently used Payees in Quick Add

Add a "Frequently used" section to the Quick Add or transaction entry flow.

Indonesian label:

- Sering digunakan

Show approximately 4 to 6 items depending on available width.

Rank Payees using explainable local logic.

Suggested first implementation:

- Transactions within the last 90 days
- Frequency score
- Recency bonus for use within the last 7 days
- Favorite bonus
- Exclude archived or invalid Payees

Centralize and unit test the ranking function.

Do not use opaque machine learning.

6.3 Selecting a Payee

When a frequently used Payee is selected:

- Fill the Payee field
- Suggest its most recent or most common category
- Suggest its last-used valid wallet
- Keep the amount empty unless a template explicitly defines it
- Keep every suggestion editable
- Allow immediate save once required fields are valid

6.4 Payee favorites

Add a lightweight favorite mechanism if the schema allows it safely.

Favorite Payees should:

- Receive ranking priority
- Be easy to add or remove
- Remain available in the full Payee list
- Not bypass archive state rules

6.5 Complete Payee list

Keep a complete Payee list accessible from:

- A "View all" link in Quick Add
- Search
- The secondary navigation or More section
- Relevant transaction detail links

Do not bury it only inside a deeply nested Settings section.

6.6 Payee card behavior

Make the primary Payee action transaction-oriented.

Each Payee card or detail view should support:

- Add transaction
- View transaction history

Secondary administrative actions belong in an overflow menu:

- Favorite or unfavorite
- Rename
- Merge
- Archive
- Restore, if applicable

The primary action should not be rename or edit.

6.7 Simplify Payee filtering

Default controls should focus on common needs:

- Search
- Highest spending
- Most recent
- Most frequent
- Alphabetical

Move granular controls into an "Advanced filters" area:

- Total spending range
- Transaction count range
- Average transaction
- Wallet and category combinations
- Full ascending and descending permutations

Do not delete power-user functionality unless it is clearly obsolete.

6.8 Payee normalization

Preserve or improve:

- Case-insensitive normalization
- Whitespace normalization
- Safe alias behavior
- Merge consistency
- Historical transaction references

If similar Payees are detected, prefer suggesting a merge rather than automatically merging records.

Phase 3 acceptance criteria:

- Frequently used Payees appear in transaction entry.
- Selecting a Payee reduces transaction-entry effort.
- Ranking is deterministic and tested.
- Full Payee management remains discoverable.
- Common sorting remains simple.
- Advanced filters remain available but secondary.
- Payee merge or rename does not alter historical totals incorrectly.

===============================================================================
7. PHASE 4: RECURRING TRANSACTIONS AND REMINDERS
===============================================================================

Objective:

Help users remember predictable financial activity without violating local-first constraints.

7.1 Recurring schedule model

Create a separate recurring schedule entity rather than generating unlimited future transactions.

Suggested fields:

- Schedule ID
- Transaction type
- Frequency
- Start date
- Next occurrence
- Optional end date
- Amount
- Category reference
- Wallet reference
- Optional Payee
- Notes
- Creation mode
- Active or paused status
- Last processed occurrence identifier

Initial frequencies:

- Weekly
- Every two weeks
- Monthly
- Yearly

Avoid scope expansion into complex cron-style scheduling during the first implementation.

7.2 Processing modes

Support:

- Remind me
- Create when Expend is opened

Do not promise guaranteed execution while the PWA is closed.

Communicate browser limitations clearly.

7.3 Duplicate prevention

Recurring processing must be idempotent.

Use a stable occurrence identity based on:

- Schedule ID
- Scheduled occurrence date

Retrying processing must not create duplicates.

Add tests for:

- Timezone changes
- Reopening the application
- Pausing and resuming
- Editing a schedule
- Missed multiple occurrences
- Month-end dates
- Leap-year behavior where relevant

7.4 Upcoming section

Create a compact Upcoming section on Home.

Show:

- Due today
- Next 7 days
- Overdue items
- Debt or receivable due dates

Show no more than three items by default.

Provide a "View all" action.

Do not show an empty, oversized section when there is nothing relevant.

7.5 Debt reminders

Support reminder preferences such as:

- 7 days before
- 3 days before
- Due date
- Overdue

Available actions:

- Record payment
- Postpone reminder
- Mark complete according to valid business behavior
- Disable reminder for this debt

7.6 Cashflow clarity

Every debt action must clearly explain wallet impact.

Examples:

- Paying a payable reduces the selected wallet balance.
- Receiving a receivable increases the selected wallet balance.
- Marking settled without recording cashflow does not change the wallet balance.
- Writing off a debt does not create a cash transaction.

Move write-off into an advanced menu and use understandable labels.

Phase 4 acceptance criteria:

- Recurring schedules cannot create duplicate occurrences.
- Schedule processing is testable and idempotent.
- Upcoming items remain compact.
- Debt reminders can be postponed or disabled.
- Debt payment and write-off effects are explicit.
- The UI does not claim reliable background execution that the browser cannot guarantee.

===============================================================================
8. PHASE 5: UI AND NAVIGATION SIMPLIFICATION
===============================================================================

Objective:

Keep frequent workflows easy to reach and reduce administrative clutter.

8.1 Navigation evaluation

Audit actual usage and current navigation before changing it.

Candidate mobile structure:

- Home
- Wallets
- Add
- Insights
- More

Candidate More sections:

Finance:
- Debts & Receivables
- Payees & Merchants
- Categories

Data:
- Backup & Restore
- Import & Export

Application:
- Appearance
- Language
- Application lock

About:
- About Expend
- Support development

Do not force this structure if repository evidence or user flow shows that Debts deserves primary navigation.

If navigation is changed:

- Preserve deep links
- Preserve browser back behavior
- Update E2E tests
- Verify narrow viewports
- Keep the central Add action prominent
- Avoid label truncation

8.2 Wallet action hierarchy

Primary actions:

- View details
- Transfer
- Edit

Advanced actions:

- Reconcile
- Archive
- Delete

Reconciliation must explain that Expend will create a balance-adjustment transaction.

8.3 Transaction action hierarchy

Primary actions:

- View details
- Edit
- Repeat

Advanced or destructive actions:

- Delete
- Bulk selection
- Bulk deletion

Do not expose bulk delete as a normal high-frequency action.

8.4 Bottom sheet behavior

Establish consistent bottom sheet rules:

- Only one main bottom sheet should be active.
- Navigating from detail to edit should replace or explicitly transition the sheet.
- Back behavior should be predictable.
- Close behavior should be predictable.
- Unsaved changes require confirmation.
- Drag-to-dismiss should be disabled or intercepted when unsaved changes exist.
- Focus must be restored when the sheet closes.

8.5 Auto-lock simplification

Prefer four understandable options:

- Immediately
- After 5 minutes
- After 30 minutes
- Never

Preserve existing settings through migration by mapping old values appropriately.

8.6 Landing simplification

Keep the consumer landing page focused on:

- Main value proposition
- Product preview
- How it works
- Privacy and local-first limitations
- Installation
- FAQ
- Final call to action

Move detailed technical stack content to README or About unless it clearly supports the target audience.

Phase 5 acceptance criteria:

- Frequent actions are reachable quickly.
- Administrative actions remain available but secondary.
- Sheet behavior is consistent.
- Unsaved data cannot be dismissed accidentally.
- Navigation remains accessible at narrow widths.
- Existing routes and links continue to work or have safe redirects.

===============================================================================
9. PHASE 6: TRAKTEER SUPPORT VISIBILITY
===============================================================================

Objective:

Make voluntary support visible without making Expend feel advertising-driven or manipulative.

9.1 Permanent Settings support card

Add a visually distinct support card in Settings.

Place it:

- After Backup & Restore, or
- Before About

Do not place it only at the very bottom after all technical settings.

Recommended English copy:

Title:
"Help Expend keep growing"

Body:
"Expend is free, ad-free, and does not sell user data. If it helps you, you can support its continued development."

Primary action:
"Treat the developer"

Supporting note:
"Support is voluntary. All Expend features remain free."

Recommended Indonesian copy:

Title:
"Bantu Expend tetap berkembang"

Body:
"Expend gratis, tanpa iklan, dan tidak menjual data pengguna. Jika aplikasi ini membantu, Anda dapat mendukung pengembangannya."

Primary action:
"Traktir pengembang"

Supporting note:
"Dukungan bersifat sukarela. Semua fitur Expend tetap gratis."

Use the project's actual Trakteer URL. Discover it from the repository or configured environment. Do not invent a URL.

9.2 About page support section

Create or improve an About section containing:

- Current version
- Author
- Open-source status
- No ads
- No tracking
- Trakteer support action
- Source-code link
- Issue-reporting link

Ensure external links are visibly identified where appropriate.

9.3 Landing support CTA

Add a secondary support CTA near the footer.

It must not compete with the primary installation or start-using-Expend action.

9.4 Contextual support prompt

Implement a non-intrusive contextual prompt after positive moments.

Eligible examples:

- First successful backup
- 30 days of meaningful use
- 100 successfully created transactions
- Successful restore
- Repeated use of monthly reports
- Successfully settling a debt

Do not show the prompt:

- During onboarding
- Before the first completed transaction
- After a failed transaction
- During insufficient balance errors
- After restore failure
- During destructive reset
- Every time the application opens
- After every transaction
- While the user is dealing with overdue or stressful financial states

9.5 Frequency controls

Persist local support prompt state.

Use centralized storage keys or an existing preference mechanism.

Suggested semantics:

- Last prompt shown timestamp
- Last prompt dismissed timestamp
- Prompt permanently suppressed flag, if provided
- Support action clicked timestamp

Initial frequency rules:

- Do not show before 14 days of meaningful use unless triggered by a strong milestone such as the first successful backup.
- Do not show more than once within 60 days.
- If dismissed, respect the cooldown.
- If the support action is clicked, stop automatic prompts for a long period or permanently according to the chosen product behavior.
- Permanent support links remain available in Settings and About.

9.6 Accessibility and external link safety

The support CTA must:

- Have visible text
- Meet touch target requirements
- Include an accessible name
- Indicate that it opens an external site
- Use safe external-link attributes where applicable
- Never include financial data, user identifiers, or private application state in the URL

9.7 Optional local measurement

If local-only product metrics already exist or are added:

Measure only:

- Support card viewed
- Support CTA clicked
- Contextual prompt shown
- Contextual prompt dismissed

Do not transmit these values.

Phase 6 acceptance criteria:

- Support CTA is visible in Settings without excessive scrolling.
- Support remains permanently discoverable in About.
- Landing support CTA is secondary.
- Contextual prompts respect cooldown rules.
- Support prompts never appear in failure or stressful financial states.
- All support copy exists in English and Indonesian.
- No user financial data is included in external links.

===============================================================================
10. PHASE 7: ACTIONABLE INSIGHTS
===============================================================================

Objective:

Convert existing financial data into understandable, verifiable guidance.

Initial insight candidates:

- Largest category increase compared with an equivalent prior period
- Current month spending compared with the prior month
- Highest-spending Payee or merchant
- Projected category budget exhaustion
- Wallet not reconciled for a long period
- Debts approaching due date
- Recurring amount increases

Insight rules:

- Use equivalent comparison periods.
- Require sufficient sample size.
- Avoid judgmental wording.
- Label projections as estimates.
- Make every insight drillable to source transactions.
- Hide sensitive values when privacy mode is enabled.
- Allow individual insights to be dismissed.
- Show no more than three insights on Home.

Do not add more chart types unless they directly improve a decision.

Phase 7 acceptance criteria:

- Every insight can be verified through drill-down.
- Sparse data does not create misleading claims.
- Privacy mode is respected.
- Calculations are unit tested.
- Insight text is localized.

===============================================================================
11. PHASE 8: IMPORT AND DATA PORTABILITY
===============================================================================

Objective:

Make CSV import understandable, recoverable, and safe.

Implement or improve a staged import flow:

1. Select file
2. Detect or choose delimiter and encoding
3. Map columns
4. Preview rows
5. Validate
6. Detect duplicates
7. Choose duplicate behavior
8. Import atomically where possible
9. Display result report

Validation report should include:

- Successful rows
- Skipped rows
- Failed rows
- Failure reason
- Optional downloadable error report

Validate at minimum:

- Positive amounts where required
- Valid dates
- Recognized transaction types
- Existing or mapped wallets
- Existing or mapped categories
- Valid transfer relationships
- Safe handling of spreadsheet formula injection
- Duplicate detection

Use a testable transaction fingerprint based on available fields such as:

- Date
- Amount
- Type
- Wallet
- Normalized description
- Payee
- External ID if provided

Allow users to:

- Skip possible duplicate
- Import anyway
- Review individually where practical

Create a pre-import snapshot before high-impact imports.

Do not add granular restore until full restore integrity is proven.

===============================================================================
12. LOCAL-ONLY PRODUCT MEASUREMENT
===============================================================================

If product measurement is implemented, it must remain local-only and optional.

Permitted metrics:

- Time from opening transaction form to successful save
- Number of visible fields modified
- Form cancellation count
- Feature-open count
- Feature-completion count
- Import success or failure count
- Last successful backup timestamp
- Number of changes since backup
- Payee shortcut use count
- Support CTA view, click, and dismissal count

Forbidden metrics:

- Amounts
- Wallet balances
- Payee names
- Merchant names
- Descriptions
- Notes
- Debt names
- Category names
- File contents
- PIN information
- Backup passwords

Provide:

- A Settings toggle
- Local diagnostic view
- Clear reset action
- Documentation that data never leaves the device

Do not add this measurement layer if it creates excessive complexity or delays critical data-safety work. In that case, create a documented follow-up task.

===============================================================================
13. FEATURES TO PRESERVE BUT DE-EMPHASIZE
===============================================================================

Preserve these capabilities unless the repository proves they are obsolete:

- Advanced Payee filters
- Merchant aliases and merge
- Debt write-off
- Wallet reconciliation
- Wallet and category archive
- Bulk deletion
- CSV import and export
- Keyboard shortcuts
- Application auto-lock
- Privacy mode
- Detailed statistics

Present them through secondary menus or advanced sections.

Do not prioritize:

- Additional keyboard shortcuts
- More static amount presets
- More chart varieties
- Mandatory accounts
- Social login
- Bank integrations
- Investment tracking
- Cryptocurrency portfolios
- Invoicing
- Gamification
- Cloud AI analysis of transactions
- Multi-user collaboration
- Mandatory cloud synchronization

===============================================================================
14. TESTING REQUIREMENTS
===============================================================================

Create or update tests for all changed business behavior.

14.1 Unit tests

Include:

- Backup reminder rules
- Backup metadata updates
- Restore validation
- Wrong encrypted-backup password
- Payee ranking
- Favorite Payee scoring
- Category suggestion precedence
- Default wallet fallback
- Transfer edit rollback
- Transfer pair invariants
- Recurring occurrence identity
- Recurring duplicate prevention
- Debt reminder calculation
- Support-prompt cooldown
- Insight calculations
- Import duplicate fingerprinting

14.2 Integration tests

Include:

- Successful backup and restore round trip
- Failed restore preserving existing data
- Transfer edit updating both wallets
- Payee selection prefilling transaction suggestions
- Recurring schedule creating exactly one occurrence
- Debt payment updating history, status, and balance
- Import creating a pre-import recovery snapshot
- Archived references falling back safely

14.3 E2E critical paths

Include:

1. New user onboarding
2. Quick Add expense
3. Add expense through a frequent Payee
4. Edit and delete transaction
5. Create and edit transfer
6. Create backup
7. Preview and restore backup
8. Record debt payment
9. View Upcoming item
10. Open support CTA from Settings
11. Dismiss contextual support prompt and verify cooldown
12. Reload application offline

14.4 Browser coverage

Use Chromium for the full critical suite.

Add limited smoke coverage for:

- Firefox
- WebKit
- Mobile viewport

At minimum verify:

- Onboarding
- Add transaction
- Backup
- Restore
- Transfer
- Offline reload

===============================================================================
15. DATABASE MIGRATION REQUIREMENTS
===============================================================================

For every schema change:

- Increment the database version according to the repository convention.
- Preserve all existing data.
- Write an idempotent migration.
- Add fixtures from at least two relevant older schema versions where practical.
- Test upgrade with existing transactions, transfers, debts, Payees, and settings.
- Ensure no duplicate records are introduced.
- Ensure old application settings map to new settings safely.
- Document the migration in CHANGELOG.md.

Potential new data areas may include:

- Backup metadata
- Payee favorite state
- Transaction templates
- Recurring schedules
- Reminder state
- Support prompt state
- Insight dismissal state

Prefer lightweight settings storage when relational querying is not needed. Use database entities where consistency, querying, or migration guarantees require them.

===============================================================================
16. PERFORMANCE AND UX BUDGET
===============================================================================

Protect the fast local-first experience.

Requirements:

- Avoid expensive full-history recalculation on every render.
- Memoize or pre-aggregate Payee scoring where appropriate.
- Add indexes only when they serve demonstrated queries.
- Avoid blocking initial application load for non-critical recommendations.
- Lazy-load advanced views if the current architecture supports it.
- Keep Quick Add responsive with a large transaction history.
- Avoid background loops.
- Do not increase bundle size substantially for a small feature.
- Do not add a large dependency when simple native logic is sufficient.

Measure or inspect:

- Initial application load
- Quick Add open time
- Payee suggestion calculation
- Home render with a large data fixture
- Restore of a large backup
- CSV preview performance

===============================================================================
17. DOCUMENTATION AND RELEASE NOTES
===============================================================================

Update:

- README
- PRODUCT documentation
- User-facing backup documentation
- Privacy and security limitations
- Recurring transaction limitations
- Support and Trakteer explanation
- CHANGELOG
- Any existing architecture or migration documentation

Documentation must clearly state:

- Data remains local unless the user explicitly exports it.
- Application PIN does not necessarily encrypt browser storage.
- Background recurring execution depends on browser capabilities.
- Trakteer support is voluntary.
- All features remain free unless the product policy explicitly changes.
- No transaction data is sent to Trakteer.

===============================================================================
18. EXECUTION ORDER
===============================================================================

Use this default order unless repository dependencies justify a safer sequence:

Phase A:
- Repository audit
- Baseline tests
- Implementation plan
- Data model review

Phase B:
- Backup metadata
- Backup status UI
- Backup reminders
- Restore snapshot and preview
- Storage error handling
- PIN copy correction

Phase C:
- Quick Add
- Default wallet
- Category suggestions
- Transaction templates
- Repeat transaction fixes
- Atomic transfer editing

Phase D:
- Frequent Payees
- Payee favorites
- Payee transaction CTA
- Simplified default filters
- Advanced Payee controls

Phase E:
- Permanent Trakteer Settings card
- About support section
- Landing support CTA
- Contextual prompt and cooldown

Phase F:
- Recurring schedules
- Upcoming section
- Debt reminders
- Cashflow clarity

Phase G:
- Navigation simplification
- Action hierarchy
- Bottom sheet consistency
- Auto-lock simplification
- Landing cleanup

Phase H:
- Actionable insights
- CSV import wizard improvements
- Additional cross-browser coverage

If the full scope is too large for one implementation run:

- Complete the highest-priority phase safely.
- Leave the repository in a passing state.
- Update the implementation plan with exact remaining tasks.
- Do not leave partially wired navigation, unused schema, unreachable UI, or untested data mutations.

===============================================================================
19. DEFINITION OF DONE
===============================================================================

A task is complete only when:

- The normal flow works.
- The failure flow is handled.
- Recovery behavior exists where needed.
- Historical data remains valid.
- English and Indonesian translations are complete.
- Keyboard and screen reader use are supported.
- Mobile widths are verified.
- The feature works offline where applicable.
- Business rules have unit tests.
- Critical flows have E2E coverage.
- Database migrations are tested.
- Documentation is updated.
- No hidden tracking or external data transmission is introduced.
- Lint, typecheck, localization checks, tests, and production build pass.

===============================================================================
20. REQUIRED FINAL REPORT
===============================================================================

At the end of execution, provide a concise but complete report containing:

1. Repository audit summary
2. Features already present before the work
3. Features implemented
4. Features intentionally deferred
5. Database and migration changes
6. Important UX decisions
7. Data-integrity protections added
8. Accessibility improvements
9. Tests added or modified
10. Exact validation commands run
11. Results of each validation command
12. Known limitations
13. Recommended next phase
14. List of changed files grouped by feature

Do not claim that a test passed unless it was actually run.

Do not claim encryption, guaranteed background execution, cloud safety, or biometric protection unless the implementation truly provides it.

===============================================================================
21. IMMEDIATE STARTING INSTRUCTIONS
===============================================================================

Begin now.

First:

1. Inspect the repository structure.
2. Read the product and technical documentation.
3. Locate the current Payee, transaction, transfer, backup, restore, Settings, About, landing, navigation, locale, database, and testing implementations.
4. Search for the current Trakteer URL and all existing support CTA references.
5. Run the current automated quality baseline.
6. Produce the implementation-oriented audit and phase checklist.
7. Start with the highest-priority safe phase.
8. Continue autonomously until the selected phase is complete and all applicable quality gates pass.

Prefer small, coherent commits if source control is available.

Suggested commit grouping:

- feat(backup): add visible backup status and reminder metadata
- feat(restore): add preview and recoverable snapshot
- feat(transactions): add progressive quick entry
- fix(transfers): support atomic transfer editing
- feat(payees): add frequent Payee transaction shortcuts
- feat(support): improve Trakteer CTA visibility
- feat(recurring): add recurring schedules and upcoming items
- refactor(navigation): simplify advanced feature access
- feat(insights): add actionable local insights
- test: expand financial invariant and critical-flow coverage

Do not create empty commits. Do not bundle unrelated formatting changes with business logic.
