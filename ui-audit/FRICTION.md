# Audit Friksi — Expend v1.16.3

**Tanggal:** 2026-08-18 · **Metode:** review kode menyeluruh + reproduksi Playwright + temuan dari audit UI/e2e sebelumnya

Kategori: 🔴 UX (menghambat pengguna) · 🟠 Teknis/Performa · 🟡 Minor

---

## A. Friksi UX — Alur Pengguna

### 🔴 A1. Pemilihan payee terkubur 3–4 interaksi
`TransactionFormSheet` (quick-add) hanya menampilkan Amount + Category + Save (progressive disclosure). Field Description — termasuk trigger "Choose payee" — berada di section **"Add details"** yang kolaps. Untuk mengisi dari payee, user harus: buka form → tap "Add details" → scroll ke bawah → tap "Choose payee" → pilih.
- **Bukti:** `TransactionFormSheet.tsx:352` (section details `(!isQuickAdd || showDetails)`), trigger di `:402`.
- **Rekomendasi:** tampilkan chip/trigger "Choose payee" di area atas quick-add; saat dipilih, ekspansi details otomatis + buka picker. (Pickernya sendiri sudah fix z-index 70 — lihat commit payee-picker.)

### 🔴 A2. Modal tak diminta muncul tepat setelah restore/import data
Setelah restore backup / import CSV / seed, muncul **WhatsNewDialog (z-120)** dan/atau **SupportPrompt (z-100)** sebagai modal full-screen yang memblokir interaksi pertama. Terbukti saat repro: tombol Add tidak bisa diklik karena terhalang overlay `z-[100]`.
- **Bukti:** `SettingsView.tsx:583` (`recordSupportMilestone('restore')`), `WhatsNewDialog` evaluate on mount, `SupportPrompt` evaluate on mount; repro Playwright.
- **Rekomendasi:** tunda kemunculan (mis. 2–3 detik) atau tampilkan sebagai banner non-blocking; beri tombol dismiss yang jelas (sudah ada X, tapi urutan "harus dismiss dulu" tetap friksi).

### 🟠 A3. Reload halaman penuh di Settings (3 titik)
`window.location.reload()` setelah: **import CSV sukses**, **restore JSON sukses**, **reset data** (`SettingsView.tsx:528, 591, 644`). Reload penuh = flash layar, kehilangan scroll/state, dan di PWA terasa berat. Padahal app berbasis **Dexie live queries** — data baru seharusnya bisa langsung terpropagasi ke UI tanpa reload.
- **Rekomendasi:** hapus reload untuk import/restore; andalkan live queries (validasi dulu bahwa derived state — onboarding flag, saldo — ikut ter-refresh).

### 🟠 A4. Hint "Create ... as new category" tidak bisa diklik
Di `CategorySelect`, saat pencarian tak menemukan kategori, muncul teks `Create "X" as new category` — tapi berupa `<div>` **bukan tombol** (`CategorySelect.tsx:161`). Kategori baru sebenarnya baru ter-create lewat konfirmasi saat **Save** (`useTransactionForm.ts:104-116`). User yang mengklik hint tersebut tidak mendapat respons.
- **Rekomendasi:** jadikan hint sebagai tombol "Create" yang langsung membuka konfirmasi, atau hilangkan teksnya agar tidak menimbulkan ekspektasi.

### 🟡 A5. Reload paksa setelah seed dev (`App.tsx:77`)
`window.location.reload()` setelah seed dev — hanya lingkungan dev, tapi menyebabkan crash repro Playwright ("Target page closed"). Bukan friksi user, tapi friksi developer.

---

## B. Friksi Teknis / Performa

### 🟠 B1. HomeView menjalankan 7 live query + agregasi turunan
`HomeView.tsx:257-269`: transactions (sorted penuh), categories, wallets, debts, debtPayments, schedules, dismissedInsightIds — plus turunan: `computeDailySpending`, debt summary, insights, upcoming. Setiap perubahan DB → semua query + agregasi jalan ulang. Untuk dataset ribuan transaksi ini halaman terberat.
- **Rekomendasi:** batasi query transaksi (mis. 500 terbaru) + virtualisasi daftar; pisahkan agregasi berat (insights) ke komponen lazy.

### 🟠 B2. `getPayeeStatsFromTransactions()` full-scan tiap panggilan
`payeeService.ts:87` membaca **semua** transaksi expense lalu mengelompokkan di memori — dipanggil oleh PayeesView (live query) **dan** PayeePickerSheet (saat dibuka). O(n) per pemanggilan.
- **Rekomendasi:** cache hasil (mis. `useMemo`/memoization per session) atau batasi window data.

### 🟠 B3. E2E WebKit/Mobile Safari flaky (form-detach timeout)
Test transfer/quick-add di WebKit & Mobile Safari sesekali timeout `waitForSelector('form input...') detached` (10s) — non-deterministik, pindah-pindah test antar run. Terbukti: kode original & kode saat ini sama-sama flake; offline-reload gagal di kedua versi (`WebKit encountered an internal error`).
- **Bukti:** run e2e multi-engine 2026-08-18 (271 passed / 5 failed → re-run 12/12 pass).
- **Rekomendasi:** dokumentasikan; pertimbangkan `--workers=1` untuk webkit lokal atau tambah retry khusus engine ini.

### 🟡 B4. Pola `setTimeout` untuk menutup dropdown (200ms onBlur)
`TransactionFormSheet.tsx:294, 387`, `PersonNameField.tsx:65` — penutupan suggestion memakai `setTimeout` onBlur; rawan race (suggestion menutup sebelum klik mendarat) di perangkat lambat. Sudah dimitigasi sebagian dengan `onMouseDown preventDefault` — tapi polanya tersebar.
- **Rekomendasi:** sentralkan ke satu util (mis. gunakan `relatedTarget` check atau pointer capture).

### 🟡 B5. Kompleksitas tinggi di kartu bisnis
`TransactionCard.tsx` & `DebtCard.tsx` memiliki NOSONAR S3776 (cognitive complexity) — logika tampilan yang padat; rawan regresi saat diubah.
- **Rekomendasi:** ekstrak sub-render (badge, menu, format) menjadi komponen kecil.

### 🟡 B6. Warna baru acak untuk kategori/dompet
`useTransactionForm.ts:112-113`, `db.ts:276`, `OnboardingWizard.tsx:57` memakai `Math.random()` dari palet untuk kategori/dompet baru — warna tidak deterministik & bisa berbenturan dengan brand (wallet default sudah di-fix ke sage, tapi kategori baru masih acak).
- **Rekomendasi:** pilih warna deterministik berikutnya (indeks berurutan dari palet) agar konsisten & bisa diprediksi.

---

## C. Yang Sudah Bagus (bukan friksi — terverifikasi)

- ✅ Pagination transaksi dengan tombol "Load more" (`HomeView.tsx:375`)
- ✅ Filter/sort/selection mode + bulk delete dengan konfirmasi (18 `confirm()` hanya untuk aksi destruktif)
- ✅ Pencarian di-debounce (`useTransactionFilters.ts:61`)
- ✅ Z-index berlapis rapi: sheet 50–70 < ConfirmDialog/HelpDialog 110 < SupportPrompt 100 < WhatsNew 120 < UpdatePrompt 200
- ✅ Help panel DebtsView bisa di-dismiss; Insights & Upcoming di-cap 3 item
- ✅ Kategori baru dibuat dengan konfirmasi (tidak silent)
- ✅ Kode bebas TODO/FIXME/HACK; NOSONAR semuanya pengecualian sah (Sonar lint)
- ✅ DatePicker punya quick-select (Today/Yesterday/2/3 hari/1 minggu)

---

## Prioritas Perbaikan

| Prioritas | Item | Effort | Dampak |
|---|---|---|---|
| 1 | A1 — payee picker di quick-add tanpa ekspansi manual | Kecil–Sedang | Tinggi (alur inti) |
| 2 | A3 — hapus reload penuh di Settings | Sedang | Tinggi (PWA) |
| 3 | A2 — tunda/deprioritaskan modal pasca-restore | Kecil | Sedang |
| 4 | A4 — "Create category" jadi tombol | Kecil | Sedang |
| 5 | B1 — ringankan HomeView | Sedang–Besar | Sedang (data besar) |
| 6 | B2, B4–B6 — teknis | Kecil–Sedang | Rendah–Sedang |

---

## Status Perbaikan (selesai — 2026-08-18)

| Item | Perubahan | File |
|---|---|---|
| A1 ✅ | Chip "Choose payee" di quick-add (grid 2 kolom dengan "Add details") — auto-expand + buka picker | `TransactionFormSheet.tsx` |
| A2 ✅ | SupportPrompt direveal setelah delay 3,5 dtk (tidak lagi memblokir langsung pasca-restore) | `SupportPrompt.tsx` |
| A3 ✅ | Reload penuh dihapus untuk import CSV & restore JSON — live queries yang propagasi; reload hanya di-reset-data | `SettingsView.tsx` (+ test e2e disesuaikan) |
| A4 ✅ | Hint "Create ... as new category" jadi tombol yang bisa diklik | `CategorySelect.tsx` |
| B1 ✅ | Input insights dibatasi 180 hari (semua builder hanya melihat ≤180d); list-windowing penuh **ditolak** — merusak total "All Time" & dropdown filter (didokumentasikan) | `HomeView.tsx`, `dateUtils.ts` (addDays) |
| B2 ✅ | `getPayeeStatsCached()` (TTL 10 dtk) untuk PayeePickerSheet; PayeesView tetap live | `payeeService.ts`, `PayeePickerSheet.tsx` |
| B3 ✅ | Skip test offline-reload di webkit (bug engine, gagal di baseline original) + `retries: 1` per project webkit/Mobile Safari — hasil: 132 passed, 4 flaky (teredam), 2 skipped, **exit 0** | `support.spec.ts`, `playwright.config.ts` |
| B4 ✅ | Hook `useDismissOnOutsideTap` menggantikan setTimeout-onBlur di 3 komponen (amount presets, description suggestions, PersonNameField) | `hooks/useDismissOnOutsideTap.ts`, `TransactionFormSheet.tsx`, `PersonNameField.tsx` |
| B5 ✅ | Ekstrak `TypeIcon`+`TxMenuItem` (TransactionCard) & `DebtStatusIcon`+`DebtMenuItem` (DebtCard) — kurangi kompleksitas menu | `TransactionCard.tsx`, `DebtCard.tsx` |
| B6 ✅ | Warna baru deterministik: indeks palet pertama yang belum terpakai (bukan `Math.random()`) di 3 tempat | `useTransactionForm.ts`, `db.ts`, `OnboardingWizard.tsx` |

**Verifikasi:** typecheck ✅ · ESLint `--max-warnings=0` ✅ · i18n (984 keys) ✅ · unit 299/299 ✅ · e2e chromium **69/69** ✅ · webkit+Mobile Safari **132 passed / 4 flaky / 2 skipped, exit 0** ✅

---

## Status 2026-08-20 — Fase A (A1–A8) selesai di v1.18.0

Inspeksi 8 friksi aktif (F1–F8) pada alur pencatatan → semua difix, satu commit per task:

| ID | Friksi | Fix | Commit |
|----|--------|-----|--------|
| A1 | Input nominal tidak bisa desimal, caret loncat | `src/utils/amountUtils.ts` (sanitize/format/parse), raw-digits saat fokus, format saat blur (GoPay pattern) | `0afb3a2` |
| A2 | Duplikat tersimpan diam-diam | `src/services/duplicateDetectionService.ts` + konfirmasi (payee+amount 30 menit, expense saja) | `55e319d` |
| A3 | Quick-add tanpa payee → kategori asal | `resolveFallbackCategory` (last-used → Other) di `categorySuggestionService.ts` | `2139c0a` |
| A4 | Konfirmasi kategori baru memaksa tiap simpan | Toggle `confirmNewCategory` (default ON) di Settings | `4e19b5d` |
| A5 | Preset nominal statis | `suggestAmountsForPayee` (frekuensi → terbaru) di `amountSuggestionService.ts` | `af2c409` |
| A6 | Jadwal berulang tak diproses saat app terbuka melewati tengah malam | Timer 60s + `visibilitychange` di `App.tsx` | `6c69404` |
| A7 | Hapus template tersembunyi di long-press | Tombol ✕ terlihat di chip template | `56a7334` |
| A8 | Quick-add hanya satu transaksi per buka | Tombol "Save & Add Another" | `0982e2a` |

Otomasi (Fase B): B1 recent-payees chips `e1346a1` · B2 web share target `7cf4e7f` · B3 paste batch `79115fb` · B4 deteksi recurring `32cd04d` · B5 OCR scan-to-form `6441d4f`.

Deferred (terdokumentasi di plan): OCR non-screenshot, template per-app, image share_target, auto-save tanpa konfirmasi, self-host tesseract core (offline OCR), precache tessdata (>2MB workbox limit).
