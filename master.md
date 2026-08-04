You are a senior product engineer, mobile UX architect, accessibility specialist, and financial data-integrity reviewer working directly inside the Expend repository.

Your mission is to perform a repository-driven, end-to-end UI/UX consistency optimization across the entire application, with UX as the primary concern and with special attention to mobile usage on Android and iOS.

Do not treat this as a cosmetic redesign.

The goal is to make every screen, component, interaction, navigation pattern, form, bottom sheet, dialog, feedback state, and destructive workflow feel like part of one coherent product.

Work autonomously. Do not ask for confirmation between normal implementation steps. Inspect the actual repository before making assumptions. If the implementation differs from this prompt, preserve the intended product behavior and adapt the technical approach to the current architecture.

Do not blindly rewrite working features. First establish the current state, identify what is already correct, locate inconsistencies and usability risks, and then implement changes in safe, testable phases.

===============================================================================
1. PRODUCT CONTEXT
===============================================================================

Expend is a privacy-first, local-first personal finance Progressive Web App.

Its core product principles are:

- Fast daily expense entry
- No account required
- No mandatory cloud services
- No advertising or tracking
- Offline-capable operation
- User-owned financial data
- Simple, precise, low-friction interaction
- Progressive disclosure for advanced functionality
- English and Indonesian localization
- WCAG AA accessibility
- Reliable financial data integrity

The application includes or may include:

- Expense and income transactions
- Quick Add transaction entry
- Transaction templates
- Wallet management
- Wallet transfers
- Wallet balance adjustment or reconciliation
- Categories and category budgets
- Debts and receivables
- Partial debt payments
- Payees and merchants
- Recurring schedules
- Upcoming reminders
- Search, filters, and sorting
- Statistics and reports
- Actionable insights
- JSON backup and restore
- CSV import and export
- PIN-based application lock
- Privacy mode
- PWA installation and offline support
- Responsive bottom navigation
- Desktop sidebar navigation
- Bottom sheets
- Dialogs
- Toasts
- Empty, loading, error, offline, and update states
- Onboarding
- Landing page
- Optional Trakteer support links

The product personality is:

- Simple
- Fast
- Precise
- Quiet
- Trustworthy
- Uncluttered
- Tool-like rather than promotional

The experience should feel lighter and faster than a banking application.

Success means:

- A familiar user can record a basic expense in less than five seconds.
- A new user can understand the primary workflow without reading documentation.
- Users can reliably predict what tapping a card, button, back control, or navigation item will do.
- Important features are discoverable without turning Settings into a feature directory.
- Forms remain usable when the Android or iOS keyboard is visible.
- Destructive and financial operations clearly explain their consequences.
- Data is never left in a partial or inconsistent state.
- All screens feel structurally and behaviorally consistent.

===============================================================================
2. OPERATING RULES
===============================================================================

2.1 Repository-first execution

Before modifying anything:

- Inspect the full repository structure.
- Read PRODUCT.md, README.md, CHANGELOG.md, package.json, and relevant planning documents.
- Inspect the current database schema and migrations.
- Inspect routing and navigation.
- Inspect all route-level views.
- Inspect shared UI primitives.
- Inspect bottom sheets, dialogs, toasts, navigation components, forms, and selectors.
- Inspect English and Indonesian locale files.
- Inspect unit, integration, and E2E test coverage.
- Inspect Tailwind and global CSS tokens.
- Inspect PWA configuration and viewport metadata.
- Inspect existing accessibility hooks such as focus traps and focus restoration.
- Inspect safe-area handling.
- Inspect unsaved-change protection.
- Inspect privacy-mode behavior.
- Inspect backup, restore, transaction, transfer, debt, recurring, category, wallet, payee, and import flows.

Do not infer file names or APIs when they can be discovered.

2.2 Preserve product behavior and financial integrity

Do not introduce:

- Mandatory accounts
- Cloud analytics
- External financial-data transmission
- Hidden network dependencies
- Bank integrations
- Social login
- Advertising
- Unnecessary dependencies
- Decorative UI that slows down frequent workflows

Never allow:

- Half-created transfers
- Orphaned transfer pairs
- Partial restores
- Incorrect wallet balances
- Duplicate recurring occurrences
- Debt payments exceeding the remaining amount
- Imports that leave partial data
- Failed operations that increment success metadata
- Destructive UI that hides its financial consequences

Use database transactions where supported.

2.3 Progressive disclosure

Keep frequent actions visible.

Frequent actions include:

- Add transaction
- Repeat transaction
- Select a frequent payee
- View recent activity
- Transfer money
- Record a debt payment
- Create a backup

Move administrative or dangerous actions into secondary menus or advanced areas.

Administrative or advanced actions include:

- Reconcile or adjust balance
- Merge payees
- Archive or restore
- Write off debt
- Bulk delete
- Granular filtering
- Delete entities
- Reset application data
- Advanced import behavior

2.4 Accessibility

All modified experiences must support:

- Semantic HTML
- Screen readers
- Keyboard-only operation
- Visible focus styles
- Focus trapping where appropriate
- Focus restoration after overlays close
- Accessible validation messages
- Error announcement
- Reduced motion
- High contrast
- 200 percent text zoom
- Touch targets of at least 44 by 44 CSS pixels
- Non-color indicators for statuses
- Logical landmark and heading structure

Verify mobile widths:

- 320 px
- 360 px
- 375 px
- 390 px
- 414 px

2.5 Localization

Every user-facing string must exist in both English and Indonesian locale files.

Do not hard-code production UI strings.

Preserve locale-aware:

- Currency formatting
- Dates
- Numbers
- Relative time
- Pluralization

Preferred terminology:

English:
- Payees & Merchants
- Debts & Receivables
- Adjust balance
- Application lock

Indonesian:
- Penerima & Merchant
- Utang & Piutang
- Sesuaikan saldo
- Kunci aplikasi

Avoid technical terminology when a user-friendly term is available.

For example:

- Prefer “Data is stored on this device” over “IndexedDB”.
- Prefer “Install as an app” over “Install the PWA”.
- Prefer “Adjust balance” over “Reconcile”, unless the technical term is explained.
- Do not imply that the application PIN encrypts browser storage.

2.6 Quality gates

After each coherent implementation phase, run the relevant quality commands available in the repository, including:

- Strict ESLint
- TypeScript type checking
- Localization key validation
- Unit tests
- Production build
- Chromium E2E tests

When available, also run limited smoke coverage in:

- WebKit
- Firefox
- Mobile Chromium viewport
- Mobile Safari or WebKit viewport

Do not claim that a command passed unless it was actually executed.

If a failure is pre-existing:

- Verify it is pre-existing.
- Document it clearly.
- Do not hide it.
- Continue only if the failure does not invalidate the current work.

===============================================================================
3. PRIMARY UX PROBLEMS TO SOLVE
===============================================================================

The repository audit should verify, refine, and address the following known areas.

Do not assume every issue still exists. Confirm each issue against the current implementation before modifying it.

3.1 Mobile navigation architecture

The existing navigation may expose only a subset of the product’s functionality.

Investigate whether route-level features such as:

- Categories
- Payees and merchants
- Recurring schedules
- Debts and receivables
- Data management
- Application preferences

are sufficiently discoverable on mobile.

The navigation must not depend on Settings as a catch-all feature directory.

Evaluate and implement the most appropriate mobile information architecture based on the current routes and actual feature importance.

Preferred candidate structure:

Option A:
- Home
- Wallets
- Add
- Statistics
- More

Option B, if debts demonstrably deserve primary navigation:
- Home
- Wallets
- Add
- Debts
- More

The central Add action should be prominent, reachable, and balanced for both right- and left-handed use.

The More destination should group features clearly:

Finance:
- Debts & Receivables
- Payees & Merchants
- Categories
- Recurring Schedules

Data:
- Backup & Restore
- Import & Export

Application:
- Appearance
- Language
- Application Lock
- Privacy

About:
- About Expend
- Support Development
- Source Code
- Report an Issue

Navigation requirements:

- Preserve deep links.
- Preserve browser Back behavior.
- Preserve existing route compatibility.
- Keep labels readable at supported widths.
- Avoid labels smaller than 11 px where possible.
- Avoid solving crowding only by shrinking text.
- Ensure active-state indication is not based only on color.
- Ensure every navigation item has a minimum 44 by 44 touch target.
- Respect bottom safe areas.
- Ensure the Add action never overlaps content, toast messages, prompts, or system navigation.

3.2 Page header consistency

Create or refine a shared page-header pattern.

Every route-level page should follow a predictable hierarchy:

- Page title
- Optional concise description
- One primary action
- Up to two secondary actions
- Overflow menu for additional actions

Standardize:

- Mobile spacing
- Heading size
- Icon size
- Alignment
- Sticky behavior
- Compact behavior on scroll, if appropriate
- Back-navigation placement on detail pages
- Overflow placement
- Screen-reader labeling

Do not overload page headers with search, sort, filter, help, add, and overflow controls simultaneously.

Create or improve a shared primitive such as PageHeader if the existing architecture supports it.

3.3 Bottom navigation and Add action

Review the existing bottom navigation and floating action button.

Problems to prevent:

- Labels that are too small
- Truncation in Indonesian
- Uneven weight among actions
- A floating button that covers list content
- Poor reachability for left-handed users
- Collision with safe areas
- Collision with keyboard, toast, or update prompt
- Duplicate Add actions in both header and floating controls

Prefer a central Add action within or visually integrated with the mobile navigation.

If the existing FAB remains:

- Add sufficient content bottom padding.
- Hide or reposition it while the keyboard is visible.
- Ensure it remains above the safe area.
- Prevent it from blocking transaction-card actions.
- Ensure toast messages appear above it.
- Verify interaction at 320 px through 414 px widths.

3.4 Bottom-sheet consistency

Audit every bottom sheet and sheet-like dialog.

Establish one shared behavioral contract.

Required behavior:

- Native or correctly implemented modal semantics
- Focus trap
- Focus restoration
- Body scroll lock
- Escape handling
- Android system Back handling
- Predictable backdrop behavior
- Safe-area-aware bottom padding
- Keyboard-aware content and action footer
- Clear close affordance
- Drag handle where appropriate
- Swipe-to-dismiss only when safe
- Unsaved-change interception
- No confusing uncontrolled sheet stacking

Define sheet size variants:

- Content-sized for action pickers, sort menus, and short option lists
- Medium for filters and short details
- Full or near-full for transaction forms and complex workflows

Do not force every sheet to occupy the same fixed height.

Prefer dynamic viewport units such as dvh where suitable, with safe fallbacks.

For forms:

- Add sticky action footers.
- Keep Save or Continue visible above the keyboard.
- Prevent dismissing dirty forms without confirmation.
- Do not allow swipe-to-dismiss if unsaved changes would be lost.
- Avoid opening a new bottom sheet on top of an existing bottom sheet.
- Use explicit in-sheet navigation or replace the current sheet state instead.

3.5 Action hierarchy

Standardize how cards and lists behave.

Users should be able to predict that:

- Tapping a card opens its detail.
- The most frequent action is visible.
- Secondary actions use a consistent location.
- Destructive and administrative actions live in overflow or detail views.

Recommended contracts:

Transactions:
- Tap card: open detail
- Primary contextual actions: Edit and Repeat
- Destructive action: Delete in detail or overflow
- Undo after delete where supported

Wallets:
- Tap card: open detail
- Primary action: Transfer
- Secondary action: Edit
- Advanced actions: Adjust balance, Archive, Delete

Debts and receivables:
- Tap card: open detail
- Primary action: Record payment
- Secondary action: Edit
- Advanced actions: Settle without cashflow, Write off, Archive, Delete

Payees and merchants:
- Tap card: open history or detail
- Primary action: Add transaction
- Advanced actions: Favorite, Rename, Merge, Archive

Categories:
- Tap card: open category details or category transactions
- Advanced actions: Edit, Archive, Delete

Requirements:

- Avoid tightly clustered icon-only buttons.
- Maintain at least 8 px of separation between unrelated or dangerous actions.
- Do not place destructive actions directly beside frequent actions without visual separation.
- Add accessible names to icon-only controls.
- Do not rely on long press as the only way to discover a function.

3.6 Search, sort, and filter consistency

Standardize search/filter/sort toolbars across:

- Home
- Wallets
- Debts
- Categories
- Payees
- Statistics
- Any other searchable list

Create a shared pattern where appropriate:

- Search field or expandable search action
- Filter button
- Sort button
- Active-filter count
- Active-filter chips
- Clear-all action

Requirements:

- Use the same icon order.
- Use the same active-state treatment.
- Use the same badge positioning.
- Do not allow badges to overlap labels or icons.
- Give search inputs a visible label or accessible label.
- Use inputMode and enterKeyHint appropriately.
- Make active filters easy to remove individually.
- Preserve active filters when navigating to detail and returning, unless product behavior says otherwise.
- Provide a clear empty result state distinct from an empty-data state.

3.7 Form and keyboard behavior

Audit all forms, especially:

- Add transaction
- Edit transaction
- Transfer
- Add/edit wallet
- Adjust balance
- Add/edit debt
- Record debt payment
- Add/edit category
- Rename or merge payee
- Recurring schedule
- PIN setup and verification
- Restore and import workflows

Required behavior:

- Required fields are obvious.
- Labels remain visible after input.
- Placeholder text is not used as the only label.
- Errors appear next to the affected field.
- A form-level error summary is available when useful.
- Errors are announced to assistive technology.
- The first invalid field receives focus after submission.
- The keyboard does not cover the primary action.
- Sticky footers remain above the Android or iOS keyboard.
- Numeric fields use appropriate keyboards.
- Enter-key behavior is logical.
- Amount formatting does not unexpectedly move the cursor.
- The final field provides a Done or Save affordance where appropriate.
- User-selected values are never silently overwritten by suggestions.
- Suggested wallet or category values are clearly identified as suggestions or defaults.
- Closing dirty forms triggers a localized discard confirmation.

For Quick Add:

- Focus on the minimum information required.
- Keep Amount, Category or suggestion, and Save visible.
- Put secondary fields under Add details.
- Keep default wallet visible enough to prevent accidental use of the wrong wallet.
- Allow frequent payees and templates without overwhelming the form.
- Preserve the full transaction form for advanced use.
- Target a familiar-user completion time of under five seconds.

3.8 Home information density

Home must remain the fastest route to daily actions.

Audit whether Home includes too many simultaneous sections:

- Summary
- Insights
- Upcoming items
- Debt summary
- Backup warning
- Support prompt
- Search
- Filters
- Sort
- Bulk selection
- Recent transactions

Establish a strict priority:

1. Page header and privacy control
2. Compact spending summary
3. Fast Add entry or frequent-payee shortcuts
4. Upcoming items only when relevant
5. No more than three actionable insights
6. Recent transactions
7. Search, filter, and sort controls
8. Contextual backup or support prompts only when appropriate

Requirements:

- Do not render large empty sections.
- Do not show multiple competing warnings or prompts at the same time.
- Keep recent transactions reachable without excessive scrolling.
- Make Insights and Upcoming compact and dismissible or collapsible where appropriate.
- Ensure a support prompt never competes with backup, failure, overdue, or destructive states.
- Keep bulk-selection mode visually distinct and hidden during normal browsing.
- Ensure the Add control does not cover the last list item.

3.9 Wallet UX

Improve clarity and hierarchy on wallet pages.

Requirements:

- Total balance has clear visual priority.
- Individual wallet cards remain compact.
- Archived wallets are separated or collapsed.
- Archived wallets do not appear in normal transaction selectors.
- Tapping a wallet consistently opens its detail.
- Transfer is the most prominent wallet action.
- Adjust balance is treated as an advanced administrative action.
- Adjust balance explains that it creates a balance-adjustment transaction.
- Deleting a wallet with transactions remains safely blocked.
- Error messages explain the recovery path rather than only stating failure.
- Wallet color is used as an accent rather than the sole status indicator.
- Privacy mode masks balances everywhere, including details and overlays.

Wallet detail should generally follow:

- Back navigation, wallet title, overflow
- Current balance
- Primary actions
- Period or filter controls
- Transaction history

Do not make wallet detail an unnecessary duplicate of Home.

3.10 Debt and receivable UX

Treat debts and receivables as distinct concepts with opposite cashflow effects.

Use clear terminology:

- Debts & Receivables
- Utang & Piutang
- I owe someone
- Someone owes me

Consider segmented controls such as:

- All
- I owe
- Owed to me

Every payment or settlement action must explain:

- Which wallet will change
- Whether the wallet balance increases or decreases
- Whether the action changes only the status
- Whether a write-off creates no cash transaction

Primary action:
- Record payment

Secondary:
- Edit

Advanced:
- Mark settled without recording cashflow
- Write off
- Archive
- Delete

Do not use ambiguous labels such as Paid when the action could mean multiple things.

Show progress without duplicating the same information unnecessarily.

3.11 Statistics mobile redesign

Audit Statistics for desktop-oriented elements such as:

- Small chart labels
- Hover-only tooltips
- Horizontal data tables
- Dense legends
- Multiple charts presenting similar information
- Tiny axis labels
- Controls that are too wide for Indonesian

Mobile requirements:

- Surface actionable summaries before detailed charts.
- Make chart points tappable.
- Do not depend on hover.
- Use labels of at least 11 or 12 px when they must be read.
- Use horizontal scroll only when necessary and provide visible affordance.
- Apply scroll snapping where helpful.
- Convert dense category tables into mobile ranked lists.
- Keep the full table behind a View full data action.
- Ensure privacy mode masks chart labels, table values, accessible descriptions, tooltips, and drill-down values.
- Make period selection compact and understandable.
- Put custom date selection in a dedicated, accessible flow.
- Ensure drill-down behavior is consistent with other detail interactions.

A mobile category row can prioritize:

- Category name
- Share of spending
- Amount
- Transaction count

Do not force users to horizontally scroll a four-column table for common information.

3.12 Categories UX

Requirements:

- Add category is the clear primary action.
- Tapping a category opens its detail or filtered transactions.
- Budget progress is secondary.
- Edit, archive, and delete live in a consistent overflow menu.
- Internal fallback identifiers never appear in the UI.
- Deletion failures explain related records and alternatives.
- Offer Archive when Delete is unsafe.
- Color selection remains accessible and does not rely only on color.
- Selected colors have a non-color indicator.
- Text remains readable against every selectable color.

3.13 Payees and merchants UX

Use user-friendly titles:

- Payees & Merchants
- Penerima & Merchant

Simplify default controls to:

- Search
- Most recent
- Most frequent
- Highest spending
- Alphabetical

Move granular criteria into Advanced filters.

Payee cards should prioritize:

- Name
- Last usage
- Transaction count or useful summary
- Favorite state
- Add transaction action

Rename or merge actions must explain the impact on historical grouping.

Do not automatically merge similar names without user control.

Selecting a frequent payee in Quick Add may suggest:

- Payee
- Category
- Last valid wallet

However:

- Keep Amount empty unless a template defines it.
- Keep every suggestion editable.
- Never overwrite a user’s explicit selection.

3.14 Recurring schedule UX

Recurring schedules must be discoverable outside deeply nested Settings.

Clearly distinguish modes:

- Remind me
- Create when Expend is opened

Do not imply that background execution is guaranteed while the PWA is closed.

Schedule cards should make the following clear:

- Schedule name or description
- Frequency
- Next occurrence
- Active or paused status
- Processing mode

Prefer Pause over Delete as the common reversible action.

Provide transparent processing feedback, such as:

- Two schedules were processed
- One transaction was created
- View created transactions

Recurring processing must remain idempotent.

3.15 Settings information architecture

Restructure Settings so that it is not one long list of unrelated controls.

Preferred grouping:

Your Data:
- Backup status
- Backup & Restore
- Import & Export

Preferences:
- Language
- Appearance
- Default wallet
- Privacy mode

Security:
- Application lock
- Auto-lock timing
- Security limitations

Management:
- Categories
- Payees & Merchants
- Recurring Schedules

Support:
- Support Expend

About:
- Version
- Open-source status
- Source code
- Report an issue

Danger Zone:
- Reset all data

Requirements:

- Place backup status near the top.
- Keep critical backup actions easy to find.
- Keep dangerous actions visually separated.
- Avoid excessive accordion nesting.
- Ensure expanded state is understandable.
- Do not give every settings row equal visual emphasis.
- Keep support visible but secondary to product functionality.
- Explain that support is voluntary.
- Do not imply that the PIN encrypts browser data.

If a More page is implemented, avoid duplicating the same navigation responsibilities inside Settings.

3.16 Landing page

Keep the landing page focused on user value.

Preferred order:

1. Direct value proposition
2. Product preview
3. How it works
4. Privacy in plain language
5. Platform-specific installation help
6. FAQ
7. Secondary support action
8. Footer

Reduce or relocate developer-oriented technical-stack content if it distracts from user understanding.

Installation guidance must distinguish:

- Android browser installation
- iOS Safari installation
- Installed standalone behavior

Avoid jargon such as IndexedDB, PWA, and local-first unless immediately explained.

3.17 Onboarding

Optimize onboarding for time-to-first-value.

Preferred flow:

1. Language
2. Concise local-data disclosure
3. Create first wallet
4. Add first transaction
5. Show backup guidance after successful use

Do not force users to configure:

- PIN
- Budgets
- Recurring schedules
- All application features

Requirements:

- Show progress when the flow has multiple steps.
- Preserve input when navigating Back.
- Allow optional steps to be skipped.
- Ensure onboarding does not reappear after completion.
- Make recovery safe if the app closes mid-onboarding.
- Avoid large blocks of educational copy.

3.18 Lock screen and sensitive-data protection

Requirements:

- Prevent sensitive financial content from flashing before the lock screen.
- Verify app-background and foreground behavior.
- Verify the PWA app-switcher snapshot where possible.
- Keep keypad or PIN controls stable when showing errors.
- Do not clear an invalid PIN before the user can understand the error.
- Use accurate security wording.
- Do not claim encryption or biometric protection unless implemented.
- Keep auto-lock options understandable:
  - Immediately
  - After 5 minutes
  - After 30 minutes
  - Never

3.19 Empty, loading, error, offline, update, and toast states

Standardize state grammar and components.

Empty state should contain:

- Short title
- One-sentence explanation
- Primary action
- Optional secondary learning action

Differentiate:

- No data exists
- No search results
- Filters removed all results
- Data failed to load

Error state should explain:

- What failed
- Whether existing data changed
- What the user can do next
- Whether Retry is available

Because the application is local-first:

- Avoid long or flashing skeleton states.
- Do not show a skeleton for data that resolves almost instantly.
- Avoid treating offline mode as a major failure.

Preferred offline message:

“You are offline. Local data remains available.”

Update prompts:

- Must not reload over an active dirty form.
- Must offer Later and Reload.
- Must preserve or warn about unsaved work.
- Must remain above the bottom navigation and safe area.
- Must not collide with toasts or the Add action.

Toasts:

- Use consistent placement and duration.
- Remain above bottom navigation, FAB, and safe areas.
- Announce important messages.
- Provide Undo where supported.
- Avoid duplicate toasts for the same failure.

===============================================================================
4. DESIGN-SYSTEM CONSISTENCY
===============================================================================

Audit the current tokens and shared primitives before introducing new ones.

Use a coherent spacing scale such as:

- 4
- 8
- 12
- 16
- 20
- 24
- 32

Recommended mobile layout behavior:

- Page horizontal padding: 16 px
- Section spacing: approximately 24 px
- Card padding: approximately 16 px
- Compact list padding: 12 to 16 px
- Form-field spacing: approximately 16 px
- Label-to-input spacing: 6 to 8 px

Typography targets:

- Page title: approximately 24 px
- Section title: approximately 18 px
- Card title: 15 to 16 px
- Body: 14 to 16 px
- Secondary text: 12 to 14 px
- Critical readable caption: minimum 11 px
- Bottom navigation labels: preferably 11 to 12 px

Audit all existing text below 11 px.

Do not enlarge every element blindly. Preserve density where readability remains acceptable.

Standardize radii:

- Inputs and buttons
- Cards
- Pills and chips
- Bottom sheets
- Dialogs
- Floating actions

Standardize button variants:

- Primary
- Secondary
- Ghost
- Destructive

Standardize button sizes:

- Normal mobile control: at least 44 px high
- Large primary mobile CTA: approximately 48 to 52 px
- Compact control only where context and accessibility permit

Standardize status presentation:

- Do not rely only on green, red, yellow, or gray.
- Pair status colors with labels, icons, shapes, or text.
- Preserve adequate contrast in light, dark, high-contrast, and privacy modes.

===============================================================================
5. ANDROID-SPECIFIC VERIFICATION
===============================================================================

Verify at least:

- Gboard does not cover sticky form actions.
- System Back closes the current overlay before leaving the page.
- System Back on a dirty form shows discard confirmation.
- Gesture navigation does not collide with bottom navigation.
- The Add action remains above system navigation.
- Date and number fields open appropriate keyboards.
- Chrome installation flow is understandable.
- Standalone mode respects theme and status-bar colors.
- Touch targets remain comfortable on high-density devices.
- Scrolling does not create accidental horizontal movement.
- Keyboard opening does not create double scrolling.
- Toasts remain visible above system and application controls.

===============================================================================
6. IOS-SPECIFIC VERIFICATION
===============================================================================

Verify at least:

- Safe-area insets in installed standalone mode.
- Safari dynamic top and bottom browser toolbars.
- Keyboard opening and closing.
- Sheet height while the keyboard is visible.
- Position-fixed behavior inside dialogs and sheets.
- Body scroll locking.
- Rubber-band overscroll.
- Swipe-back behavior.
- Orientation changes.
- Date-input appearance.
- Decimal keyboard behavior.
- Standalone status-bar area.
- Focus retention after closing native pickers.
- The viewport does not jump when focusing inputs.
- Sensitive data is not exposed before lock-screen presentation.
- Home-indicator safe area is respected by bottom navigation and sheet actions.

Prefer dynamic viewport units when suitable and provide fallbacks.

===============================================================================
7. IMPLEMENTATION PHASES
===============================================================================

Execute the work in small, coherent phases.

Do not combine unrelated large changes into one uncontrolled patch.

Phase 0 — Repository audit and baseline

- Map every route-level page.
- Map desktop and mobile navigation.
- Catalog shared primitives.
- Catalog all sheet and dialog variants.
- Catalog all forms.
- Catalog search/filter/sort patterns.
- Catalog empty/loading/error states.
- Catalog text smaller than 11 px.
- Catalog touch targets smaller than 44 px.
- Catalog direct hard-coded UI strings.
- Catalog unsafe fixed-position controls.
- Catalog horizontal-overflow areas.
- Catalog unsaved-form behavior.
- Record existing automated test coverage.
- Run the baseline quality commands.
- Create an implementation-oriented audit document.

Phase 1 — Shared UX contracts

Implement or refine:

- PageHeader
- Mobile navigation contract
- More page or equivalent feature navigation
- Central Add action or safe FAB behavior
- BottomSheetShell variants
- Sticky form actions
- Search/filter/sort toolbar pattern
- Button variants
- Empty state
- Error state
- Loading behavior
- Toast placement
- Safe-area utilities
- Dynamic viewport utilities where required

Phase 2 — Navigation and discoverability

- Implement the selected mobile information architecture.
- Preserve every route.
- Add More or equivalent consolidated navigation.
- Remove feature-directory responsibilities from Settings where appropriate.
- Update desktop sidebar consistently.
- Update active states and accessibility labels.
- Verify browser Back and deep links.
- Update related E2E tests.

Phase 3 — Core daily workflow

Optimize:

- Home
- Quick Add
- Transaction form
- Transaction details
- Edit transaction
- Repeat transaction
- Transaction action hierarchy
- Search, filter, and sort
- Frequent payees
- Templates
- Keyboard behavior
- Sticky Save
- Confirm discard
- Undo behavior

Phase 4 — Financial entities

Optimize:

- Wallet list
- Wallet detail
- Transfers
- Adjust balance
- Debts and receivables
- Debt payment
- Settlement
- Categories
- Payees and merchants
- Recurring schedules

Preserve all financial invariants.

Phase 5 — Statistics and information-heavy screens

- Redesign mobile information hierarchy.
- Replace common dense tables with mobile ranked lists.
- Keep full data available as progressive disclosure.
- Improve chart tap behavior.
- Improve period controls.
- Verify privacy masking.
- Verify narrow layouts and 200 percent zoom.

Phase 6 — Settings, onboarding, landing, and security

- Restructure Settings.
- Improve backup prominence.
- Simplify onboarding.
- Improve platform-specific installation guidance.
- Simplify landing information hierarchy.
- Verify lock-screen behavior.
- Correct security wording.
- Keep support secondary and voluntary.

Phase 7 — Cross-cutting states and polish

- Empty states
- Search-empty states
- Filter-empty states
- Error recovery
- Offline banner
- Update prompts
- Toasts
- Loading transitions
- Reduced-motion behavior
- High-contrast behavior
- Horizontal-scroll affordance
- Scroll snap where useful
- Animation consistency

Phase 8 — Verification and documentation

- Run all quality gates.
- Run mobile viewport tests.
- Run critical WebKit and Firefox smoke tests where possible.
- Capture screenshots at target widths where the test environment supports it.
- Update README, PRODUCT documentation, UX implementation plan, and CHANGELOG where appropriate.
- Produce a final report with exact commands and results.

===============================================================================
8. TESTING REQUIREMENTS
===============================================================================

Update or create tests for changed behavior.

8.1 Component and unit tests

Cover:

- Navigation configuration
- Active route behavior
- More-page grouping
- Sheet size variants
- Sheet close behavior
- Dirty-form interception
- Focus restoration
- Filter badge positioning or behavior
- Search-state behavior
- Keyboard-aware footer logic where testable
- Privacy masking helpers
- Localized labels
- Status labels
- Recurring mode wording
- Financial-impact messaging
- Any changed business invariant

8.2 Integration tests

Cover:

- Opening a detail and returning to the same list state
- Preserving search and filters after detail navigation
- Add form with default wallet
- User-selected category not overwritten by suggestions
- Dirty-form close confirmation
- Transaction deletion and Undo
- Transfer edit preserving both sides
- Debt payment showing the correct wallet impact
- Settings navigation to management features
- Backup status placement and action
- Update prompt not interrupting dirty forms

8.3 E2E critical paths

At minimum:

- New-user onboarding
- Create the first wallet
- Quick Add an expense
- Add an expense from a frequent payee
- Edit a transaction
- Delete and Undo
- Create and edit a transfer
- Open wallet detail and return
- Add a debt or receivable
- Record a partial debt payment
- Find and manage categories
- Find and manage payees
- Create or pause a recurring schedule
- Open Statistics and drill into data
- Create a backup
- Preview and cancel restore
- Enable privacy mode
- Configure application lock
- Open support action
- Reload offline
- Trigger system or browser Back from an open sheet
- Attempt to close a dirty form
- Verify navigation at target mobile widths

8.4 Required mobile viewport matrix

Run relevant smoke flows at:

- 320 by 568
- 360 by 800
- 375 by 667
- 390 by 844
- 414 by 896

Include at least one reduced-height viewport with the keyboard simulated or otherwise accounted for where possible.

8.5 Accessibility checks

Verify:

- Landmark order
- Heading hierarchy
- Accessible names
- Dialog labeling
- Focus trap
- Focus restoration
- Visible focus
- 200 percent zoom
- No horizontal page overflow
- Screen-reader announcements
- Status not conveyed by color alone
- Touch-target size
- Reduced motion

===============================================================================
9. USABILITY ACCEPTANCE SCENARIOS
===============================================================================

Use these scenarios as implementation acceptance criteria.

A user must be able to:

1. Create the first wallet and first transaction without documentation.
2. Add a familiar expense in under five seconds after becoming familiar with the app.
3. Correct an incorrect transaction.
4. Delete a transaction and Undo.
5. Transfer money between wallets.
6. Adjust a wallet balance while understanding that an adjustment transaction will be created.
7. Record a partial debt payment and understand the wallet impact.
8. Find Categories without searching inside unrelated settings.
9. Find Payees & Merchants and add a transaction from a payee.
10. Find and create a recurring schedule.
11. Find and create a backup in no more than two navigation decisions.
12. Preview a restore and cancel safely.
13. Enable application lock while understanding its limitations.
14. Enable privacy mode and see all sensitive values masked.
15. Complete key workflows at 200 percent text zoom.
16. Complete key workflows using only a keyboard.
17. Use the application offline without interpreting offline mode as a failure.
18. Enter data into a form and press system Back without losing changes silently.
19. Use the application with a large transaction history.
20. Use the application in portrait and landscape where supported.

No critical scenario should result in:

- An unclear Back action
- A Save button hidden by the keyboard
- A destructive action triggered accidentally
- A feature discoverable only through deep Settings navigation
- A nested sheet trap
- A horizontal page overflow
- Financial data visible through privacy mode
- A partial financial mutation
- An untranslated string
- A touch target smaller than the agreed minimum

===============================================================================
10. PERFORMANCE CONSTRAINTS
===============================================================================

Protect the local-first speed of the product.

Do not:

- Add a large UI dependency for simple primitives.
- Add heavy animation libraries without strong justification.
- Recalculate full transaction history on every render.
- Render all data when progressive rendering is available.
- Add artificial loading states.
- Add unnecessary network requests.
- Block initial render for secondary recommendations.
- Increase bundle size substantially for minor visual improvements.

Inspect:

- Initial load
- Home render with large fixtures
- Quick Add opening time
- Search filtering
- Statistics rendering
- Large wallet history
- Large payee list
- Long Settings view
- Restore preview
- CSV preview

===============================================================================
11. CHANGE MANAGEMENT
===============================================================================

Keep changes reviewable.

Use coherent commit groups if source control is available.

Suggested commit grouping:

- refactor(ux): establish shared mobile layout primitives
- refactor(navigation): improve mobile feature discoverability
- fix(mobile): standardize safe-area and keyboard behavior
- refactor(sheets): unify bottom-sheet interaction patterns
- refactor(forms): add consistent sticky actions and validation
- refactor(home): simplify daily transaction workflow
- refactor(wallets): clarify wallet action hierarchy
- refactor(debts): clarify payment and settlement behavior
- refactor(stats): improve mobile reports and data presentation
- refactor(settings): reorganize application preferences
- fix(a11y): improve focus, labels, and zoom behavior
- test(e2e): expand mobile critical-flow coverage
- docs(ux): document navigation and interaction standards

Do not create empty commits.

Do not include unrelated formatting changes.

Do not leave:

- Unused components
- Unreachable routes
- Duplicate navigation sources
- Dead locale keys
- Partially migrated sheets
- Old and new patterns active without a deliberate compatibility reason
- Debug logging
- Placeholder copy
- TODO-only implementations

===============================================================================
12. REQUIRED AUDIT DOCUMENT
===============================================================================

Before major implementation, create or update a repository document containing:

- Current route inventory
- Current mobile navigation
- Current desktop navigation
- Existing shared UI primitives
- Identified inconsistencies
- Confirmed issues
- Rejected assumptions
- Accessibility risks
- Android risks
- iOS risks
- Financial data-integrity risks
- Proposed navigation architecture
- Proposed shared component contracts
- Implementation phases
- Tests required
- Completion checklist

Keep the audit implementation-oriented and concise enough to remain useful.

Do not spend excessive time writing speculative documentation instead of implementing verified improvements.

===============================================================================
13. DEFINITION OF DONE
===============================================================================

The UX optimization is complete only when:

- Route-level pages follow a consistent structural hierarchy.
- Mobile navigation makes important functionality discoverable.
- Add Transaction remains the most prominent frequent action.
- Page headers follow a shared contract.
- Search, sort, and filter behavior is consistent.
- Bottom sheets follow a shared behavioral contract.
- Dirty forms cannot be dismissed silently.
- Primary form actions remain visible above mobile keyboards.
- Card tap behavior is predictable.
- Destructive actions are safely secondary.
- Wallet, transfer, debt, and restore operations preserve financial invariants.
- Statistics are usable without desktop-style table interaction.
- Settings has a clear information architecture.
- Categories, payees, and recurring schedules are discoverable.
- Privacy mode masks sensitive data everywhere.
- Offline mode is communicated accurately.
- Android and iOS safe areas are respected.
- Touch targets meet the minimum size.
- Text remains usable at supported widths and 200 percent zoom.
- English and Indonesian localization is complete.
- Relevant unit and E2E tests are updated.
- Lint passes.
- Type checking passes.
- Localization validation passes.
- Unit tests pass.
- Production build passes.
- Chromium E2E passes.
- Available mobile, Firefox, and WebKit smoke tests pass or any environment limitation is documented.
- README, product documentation, planning documents, and CHANGELOG are updated where relevant.

===============================================================================
14. REQUIRED FINAL REPORT
===============================================================================

At the end, provide a concise but complete report containing:

1. Repository audit summary
2. Confirmed UX issues
3. Assumptions that were rejected after inspection
4. Pages reviewed
5. Shared components reviewed
6. Navigation changes
7. Page-header changes
8. Bottom-sheet changes
9. Form and keyboard changes
10. Home changes
11. Wallet changes
12. Debt and receivable changes
13. Statistics changes
14. Categories and payee changes
15. Recurring schedule changes
16. Settings changes
17. Landing and onboarding changes
18. Accessibility improvements
19. Android-specific improvements
20. iOS-specific improvements
21. Data-integrity protections preserved or added
22. Tests added or modified
23. Exact validation commands executed
24. Result of every validation command
25. Known limitations
26. Deferred improvements
27. Recommended next phase
28. Changed files grouped by feature

Do not claim:

- A test passed when it was not run
- iOS compatibility when WebKit behavior was not checked
- Encryption when the PIN only guards the UI
- Guaranteed background recurring execution
- Complete accessibility compliance based only on static inspection

===============================================================================
15. IMMEDIATE STARTING INSTRUCTIONS
===============================================================================

Begin now.

First:

1. Inspect the repository structure.
2. Read the product and technical documentation.
3. Identify every route and route-level page.
4. Inspect all navigation components.
5. Inspect all shared layout and UI primitives.
6. Inspect every bottom sheet, modal, dialog, and form.
7. Inspect mobile safe-area, viewport, and keyboard handling.
8. Inspect the locale files.
9. Inspect existing mobile and accessibility tests.
10. Run the current automated quality baseline.
11. Create the repository-based UX audit and implementation checklist.
12. Select the highest-impact safe phase.
13. Implement changes in coherent phases.
14. Run quality gates after each phase.
15. Continue autonomously until the selected scope is complete and the repository is left in a passing state.

Prioritize the following order unless repository evidence justifies a safer alternative:

1. Critical form, keyboard, Back, privacy, and safe-area problems
2. Shared UX contracts
3. Navigation and discoverability
4. Home and transaction entry
5. Bottom-sheet consistency
6. Wallet and transfer hierarchy
7. Debts and receivables
8. Statistics mobile usability
9. Settings information architecture
10. Categories, payees, and recurring schedules
11. Landing and onboarding
12. Cross-browser and accessibility polish

If the entire scope cannot be completed safely in one run:

- Complete the highest-priority coherent phases.
- Leave the repository in a passing state.
- Do not leave partially connected navigation or half-migrated components.
- Update the implementation checklist with exact remaining tasks.
- Document why each deferred item was not completed.
- Provide the exact next implementation step.

The final product should not merely look consistent.

It should behave consistently, remain fast, protect financial data, support mobile ergonomics, and allow users to complete daily financial tasks without having to stop and think about how the interface works.
