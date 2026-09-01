# Expend - Chat Pencatatan Pengeluaran

![version](https://img.shields.io/badge/version-0.2.8-teal)

Offline-first PWA. Navigasi: **Home** (daftar transaksi) + **Chat** (auto tercatat).

## Cara pakai
Chat: `beli kopi di Indomaret 50000` → preview `Kopi Di Indomaret · Rp50.000` → Simpan.

Format nominal: `50000` `50.000` `50rb` `50k` `1,5jt`. Klausa wallet `dari|pakai|pake|via ...` otomatis diabaikan.

## Stack
React 19 + Vite 6 + Tailwind 4 + Dexie 4 (IndexedDB) + `reicon-react`. Icons 100% `reicon.dev`.

## Scripts
`npm run dev` `npm run build` `npm run typecheck` `npm run test`

## Versioning
Semver + Conventional Commits tiap commit.
