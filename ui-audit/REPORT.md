# Audit UI Pixel-Perfect — Expend v1.16.3

**Tanggal:** 2026-08-18 · **Metode:** Playwright (chromium + webkit) + review kode
**Cakupan:** 10 route utama + Landing + Onboarding + 2 overlay, di 3 viewport → **51 capture**

| Viewport | Engine | Ukuran |
|---|---|---|
| Desktop | Chromium | 1440×900 |
| Android (Pixel 5) | Chromium mobile | 393×851 · DPR 2.75 · touch |
| iOS (iPhone 13) | WebKit (Safari) mobile | 390×844 · DPR 3 · touch |

**State yang diaudit:** data terisi (seed demo + 3 utang/piutang + 2 jadwal recurring), state kosong (6 halaman), Landing (fresh), light & dark mode.

📸 **Screenshot lengkap:** `ui-audit/out/<viewport>/<halaman>.png` (+ `-landing`, `-empty`, `overlay-*`, `landing-light/dark.png`, `home-light/dark.png`)

---

## Ringkasan Eksekutif

| # | Temuan | Severity | Status | Lokasi |
|---|---|---|---|---|
| 1 | Mockup phone di Hero **tidak terbaca di light mode** (teks putih di atas latar terang, kontras 1.1:1) | 🔴 Kritis | ✅ **Diperbaiki** (mockup di-lock dark) | `views/landing/HeroSection.tsx`, `PreviewSection.tsx` |
| 2 | Kontras teks light mode di bawah WCAG AA (4.5:1) | 🔴 Tinggi | ✅ **Diperbaiki** (token `--accent`/`--expense` light digelapkan) | `index.css` |
| 3 | Judul halaman **terpotong** (`truncate`) di mobile — "Categories & Budgets" | 🟠 Sedang | ✅ **Diperbaiki** (wrap 2 baris) | `components/PageHeader.tsx`, `SummaryCard.tsx` |
| 4 | **Touch target 36px** — inkonsisten dengan standar 44px aplikasi | 🟠 Sedang | ✅ **Diperbaiki** (→ `min-h-[44px]`) | Debt/Stats/Home chips, landing CTA, `StickyCta`, `App.tsx` |
| 5 | 28 tombol `bg-[var(--accent)] text-white` — kontras label 3.1–4.0:1 (di bawah 4.5) | 🟠 Sedang | ✅ **Diperbaiki** (→ `bg-[var(--accent-fill)] text-[var(--accent-ink)]`) | 24 file komponen/view |
| 6 | Duplicate SVG `clipPath` id (`clip0_…`) — HTML invalid (minor) | 🟡 Rendah | ✅ **Diperbaiki** (`MutationObserver` dedupe) | `utils/svgIdDedupe.ts`, `App.tsx` |
| 7 | Warna default dompet `#6366f1` (indigo) — di luar bahasa warna brand (sage) | 🟡 Rendah | ✅ **Diperbaiki** (→ hijau brand `#7A9B6A`) | `WalletColorPicker.tsx`, `WalletFormSheet.tsx`, migrasi v11 |
| 8 | Warna semantik `--danger`/`--warning` ada tapi beberapa tempat masih `red-500`/`amber-500` | 🟡 Rendah | ✅ **Diperbaiki** (→ token `--danger`/`--warning`/`--success`) | TransactionCard, Debt sheets, PIN modals, LockScreen, dll |

**Verifikasi pasca-perbaikan** (Playwright, `ui-audit/verify.mjs`):
- ✅ Hero CTA & eyebrow: **5.28:1** (light) / **5.42:1** (dark) — lolos AA 4.5:1
- ✅ Teks mockup phone: **14.68:1** di kedua tema (mockup di-lock dark)
- ✅ `clipPath` duplikat: **0 di semua halaman** (landing, home, categories, more — desktop & mobile)
- ✅ H1: **tidak ada yang terpotong** (trunc=false) di desktop + Android + iOS
- ✅ Touch target < 36px: 0 di halaman app (sisa hanya link teks landing: FAQ/GitHub/scroll-hint — bukan kontrol utama)
- ✅ Typecheck & ESLint `--max-warnings=0` bersih · **299/299 unit test lulus**

**Full E2E (state final, 2026-08-18):**
- ✅ **chromium 69/69 · Mobile Chrome 69/69** — full CRUD semua halaman hijau (138/138 di run final)
- ✅ Re-audit pixel-perfect 51 capture (desktop/Android/iOS WebKit): **0 isu** semua kategori
- ⚠️ WebKit/Mobile Safari: `offline reload` gagal di WebKit (`WebKit encountered an internal error` — **gagal identik di kode original**, pre-existing, bukan regresi); beberapa test transfer flake intermiten (form-detach timeout 10s, non-deterministik — set flake 12/12 lulus saat diuji ulang). CI memang di-pin ke chromium (`playwright.config.ts`)

**Yang sudah BAGUS (terverifikasi otomatis):**
- ✅ **Tidak ada horizontal overflow** di semua 51 capture (3 viewport, 13+ state) — `scrollWidth` = viewport width selalu
- ✅ Tidak ada overlap bottom nav dengan konten (padding `main` ≥ tinggi nav)
- ✅ Font Plus Jakarta Sans & JetBrains Mono termuat di semua engine
- ✅ Tidak ada gambar rusak, tidak ada kontrol tanpa accessible name
- ✅ Dark mode (default) kontrasnya sehat: CTA 5.4:1, expense 4.7:1, mockup 16.9:1
- ✅ Konsistensi radius & token cukup terjaga (`rounded-[16px]` kartu, `rounded-xl` input, `rounded-full` chip)

---

## Temuan Detail (Ranked Punch List)

### 🔴 1. Hero mockup tidak terbaca di light mode — `HeroSection.tsx`
Mockup phone di hero meng-hardcode `text-white`, `text-white/70`, `text-white/40` untuk semua teks, tetapi layar mockup memakai `bg-[var(--bg)]` dan baris transaksi `bg-[var(--card)]`. Di light mode: bg `#F2F4EE`/`#FAFAF7` + teks putih → **kontras 1.1:1 (praktis tak terlihat)**.
- Bukti: `landing-light.png` vs `landing-dark.png` (16.9:1 di dark).
- Elemen terdampak: judul "Expend", nama transaksi demo, waktu, nominal, label kategori (semuanya putih).
- **Rekomendasi:** pakai token (`var(--text-primary)` / `var(--text-secondary)`) di mockup, atau paksa mockup selalu dark (`bg-[#1A1E16]`) — mockup bertema gelap di halaman terang justru tampak kontras & premium.

### 🔴 2. Kontras light mode di bawah AA (4.5:1)
| Elemen | Ratio | Lokasi |
|---|---|---|
| Tombol "Get Started" / "Start Tracking" (teks `var(--bg)` di atas `--accent` #5E8A4A) | **3.64:1** | Landing Hero + FinalCTA |
| Eyebrow "Privacy-first expense tracking" (`--accent` di atas `--bg`) | **3.64:1** | Landing Hero |
| Nav aktif, chip "This Month", link "View", nominal accent (hijau #5E8A4A di atas card) | **3.85:1** | Home, Sidebar |
| Nominal expense (`--expense` #B86B5A di atas card) | **3.6–3.8:1** | TransactionCard |
| Teks di balance card (`--accent-ink`/70 & /60 di atas `--accent-fill`) | ±3.2–3.7:1 | SummaryCard |

Dark mode versi sama: 4.7–6.3:1 ✅ → masalah **khusus light mode** (token accent/expense light terlalu muda).
- **Rekomendasi:** gelapkan `--accent` & `--expense` untuk light (`--accent` → ≈`#4A6E3C`, `--expense` → ≈`#A8503C`), atau gunakan `--accent-fill` untuk tombol + `--accent-text` untuk teks.

### 🟠 3. H1 terpotong di mobile — `PageHeader.tsx`
`<h1 class="truncate">` → judul panjang dipotong dengan ellipsis. Terverifikasi: "Categories & Budgets" terpotong di Android (207/240px) dan iOS (204/240px). Judul halaman adalah elemen paling penting secara semantik — tidak boleh terpotong.
- **Rekomendasi:** ganti `truncate` dengan `min-w-0` + `text-balance`/wrap 2 baris.

### 🟠 4. Touch target 36px (standar app = 44px)
`min-h-[36px]` pada: chip filter utang ("All / You Owe / Owed to You"), chip quick-filter Home ("Today / This Week"), tombol period Stats ("This Month" 19px!), chip di DebtPaymentSheet, tombol toggle data table. WCAG 2.5.8 min 24px (lolos) tapi inkonsisten dengan konvensi 44px app & menyulitkan jempol di layar kecil.
- **Rekomendasi:** samakan ke `min-h-[44px]` (atau minimal 40px) pada semua elemen interaktif.

### 🟠 5. 28 tombol `bg-[var(--accent)] text-white`
Kontras label: dark 3.1:1, light 4.0:1 — keduanya < 4.5:1 (teks kecil). Tombol primer seharusnya `bg-[var(--accent-fill)] text-[var(--accent-ink)]` (dark 5.1:1 ✓). Untuk chip aktif state, pertimbangkan teks gelap di atas accent (pola hero: `text-[var(--bg)]` = 5.4:1 ✓).
- **Rekomendasi:** audit 28 titik, alihkan tombol primer ke `--accent-fill`; pertahankan accent hanya untuk aksen/ikon/teks dengan `--accent-text`.

### 🟡 6. Duplicate `clipPath` id di SVG
`clip0_17007_…` muncul 2× di DOM (`/` dan `/more`) — dari ikon reicon-react yang di-inline dengan id clipPath statis. HTML dengan id duplikat invalid (a11y/validasi) walau render tidak terpengaruh.
- **Rekomendasi:** set `clipPathUnits` + id unik per instance (atau wrapper `<svg aria-hidden>` + hapus id jika tak dipakai).

### 🟡 7. Warna default dompet indigo
`DEFAULT_COLOR = '#6366f1'` dan migrasi v11 memakai indigo — berbenturan dengan bahasa warna brand sage-green. Minor, tapi konsistensi brand akan lebih baik bila default = hijau brand.
- **Rekomendasi:** default wallet color → `#7A9B6A` (atau warna palet kategori).

### 🟡 8. Token semantik tidak dipakai konsisten
`--danger`/`--warning` sudah didefinisikan (dengan varian dark/light/`-bg`), tapi masih ada `text-red-500`, `bg-red-500/10`, `text-amber-500`, `bg-amber-100 dark:bg-amber-900/40` di: ConfirmDialog, VerifyCurrentPinModal, PinSetupModal, TransactionCard (badge + menu delete), DebtDetailSheet, SummaryCard insight, BackupStatusCard.
- **Rekomendasi:** pindahkan ke `var(--danger)` / `var(--warning)` (+ `--danger-bg`/`--warning-bg`) agar otomatis adaptif di light/dark/high-contrast.

---

## Matriks Per Halaman

| Halaman | Desktop | Android | iOS | Catatan |
|---|---|---|---|---|
| Landing (+onboarding) | ⚠️ | ⚠️ | ⚠️ | Mockup putih di light mode; CTA 36–40px |
| Home (data) | ✅ | ✅ | ✅ | Expense amount kontras 3.6 di light |
| Home (kosong) | ✅ | ✅ | ✅ | — |
| Wallets | ✅ | ✅ | ✅ | — |
| Wallet Detail | ✅ | ✅ | ✅ | — |
| Debts | ✅ | ⚠️ | ⚠️ | Chip filter 36px |
| Stats | ✅ | ✅ | ✅ | Category label truncate (OK, ellipsis) |
| Categories | ✅ | ⚠️ | ⚠️ | **H1 terpotong** |
| Payees | ✅ | ✅ | ✅ | — |
| Schedules | ✅ | ✅ | ✅ | Judul kartu truncate (OK) |
| Settings | ✅ | ✅ | ✅ | — |
| More | ✅ | ✅ | ✅ | — |
| Overlay: Action Picker / Tx Form | ✅ | ✅ | ✅ | — |

✅ = tanpa isu layout/kontras kritis · ⚠️ = isu touch-target/H1

---

## Cara Reproduksi
```bash
npm run dev &                      # :3000
node ui-audit/audit.mjs            # 51 capture + data.jsonl
node ui-audit/contrast-check.mjs   # perbandingan dark/light
node ui-audit/verify.mjs           # verifikasi pasca-perbaikan (kontras, H1, dedupe, touch)
```
Artefak: `ui-audit/out/*.png`, `ui-audit/out/data.jsonl` (data mentah geometri/kontras).
