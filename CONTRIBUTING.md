# Contributing

Thanks for improving Expend. Keep changes small, tested, and aligned with the
offline-first and privacy-first constraints.

## Setup

Requires Node.js 22 or newer.

```bash
npm ci --ignore-scripts
npm run vendor:ocr
npm run dev
```

`npm run dev` binds to localhost. Use `npm run dev:lan` only when testing from a
phone on the same network.

## Before opening a pull request

Run:

```bash
npm run lint
npm run lint:prose
npm run typecheck
npm run test:coverage
npm run build
```

Run the relevant Playwright spec when changing a flow or layout. E2E receipt
fixtures are generated at runtime. Do not add binary fixtures that are ignored
by Git.

## Branches and commits

- Branch from `main`.
- Use Conventional Commits: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`,
  `test:`, `ci:`, or `chore:`.
- Keep the subject in the imperative mood and under 72 characters.
- Do not mix unrelated refactors with behavior changes.

## Code style

- TypeScript strict mode is required.
- Prefer existing utilities and tokens over new abstractions.
- User-facing strings go through `src/i18n`. Both Indonesian and English keys
  must be added together.
- Do not use em dashes in prose or comments. `npm run lint:prose` enforces it.
- IndexedDB writes that belong together must share one Dexie transaction.
- New interactive controls need a 48 px target, a visible focus state, and an
  accessible name.

## Pull request checklist

- [ ] The change has a focused description and linked issue.
- [ ] Unit tests cover new logic or a regression.
- [ ] Lint, prose, typecheck, coverage, and build pass.
- [ ] Light, dark, high contrast, and 200 percent font size were considered.
- [ ] Loading, empty, error, and success states were considered.
- [ ] No transaction data, secrets, or real receipts are included.
- [ ] Documentation was updated when behavior, storage, or operations changed.

## Security

Do not report vulnerabilities in a public issue. Follow `SECURITY.md`.
