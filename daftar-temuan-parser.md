# Daftar Temuan & Analisis Edge Cases Parser

Dokumen ini berisi daftar lengkap temuan, potensi *bug*, logika keliru, serta *edge cases* yang ditemukan dalam modul parser (`amountRank.ts`, `chatParser.ts`, `receiptParser.ts`, dan `sources.ts`).

---

## 1. Deteksi Sumber Dana & Merek (`sources.ts`)

| No | Modul / Lokasi | Deskripsi Temuan | Masalah & Impact |
|---|---|---|---|
| **1.1** | `sources.ts` | **Urutan Preferensi Brand Utama vs Sub-brand**<br>`BCA` (`/\bbca\b/i`) diletakkan sebelum `BCA Syariah` (`/bca\s*syariah/i`). | Karena `SOURCES.find()` mengeksekusi secara sekuensial, input `"Transfer via BCA Syariah"` akan terdeteksi sebagai `"BCA"` karena regex `\bbca\b` terpicu lebih awal. |
| **1.2** | `sources.ts` | **Kata Umum Terdeteksi Merek (False Positive)** *(dengan nuansa)*<br>Entitas `Dana` (`/\bdana\b/i`) dan `Kas` (`/\bkas\b/i`) dicocokkan pada seluruh teks. Catatan: di `chatParser`, hasil scan penuh hanya diterima bila `Tunai`/`Kas`, jadi `"Pengeluaran dana darurat 500rb"` tidak pernah jadi `Dana` di jalur chat — risiko nyata ada di scan penuh `receiptParser` (mis. SMS `"dana masuk"`). | `Kas`/`Tunai` sengaja dipertahankan sebagai generic source (test lama `kopi 20rb kas` → `Kas`). Perbaikan: `Dana` kini hanya dikenali saat ALL-CAPS `DANA`/`Dana` (nama resmi e-wallet), bukan `dana` lowercase. |
| **1.3** | `sources.ts` | **Karakter Aksen pada Regex OCBC**<br>Pattern pertama OCBC tertulis `/ocbc\s*níaga/i` (menggunakan huruf `í` beraksen). | Teks OCR standar `"OCBC Niaga"` tidak cocok dengan pola pertama dan terpaksa menggunakan pola fallback `\bocbc\b`. |
| **1.4** | `sources.ts` | **Regex Tanpa Word Boundary (`\b`)**<br>Entitas seperti `Maybank`, `HSBC`, `DBS`, dan `ICBC` tidak menggunakan pembatas kata. | Berisiko memicu *false positive* pada sub-string teks lain seperti URL, alamat email, atau ID transaksi. |

---

## 2. Logika Scoring & Pemilihan Nominal (`amountRank.ts`)

| No | Modul / Lokasi | Deskripsi Temuan | Masalah & Impact |
|---|---|---|---|
| **2.1** | `amountRank.ts` | **Skor Linear Mengalahkan Sinyal Konteks**<br>Skor dihitung dengan perkalian langsung (`score = value * multiplier`). | Angka ID/Nomor HP tanpa indikator uang (misal `1.000.000`) ber-skor `1.000.000`, sementara angka nominal dengan sinyal jelas (misal `"Total 50.000"` $\rightarrow$ `50.000 * 2.2 = 110.000`) kalah skor secara drastis. |
| **2.2** | `amountRank.ts` | **Penalti Bare Numbers Tidak Membedakan Kuantitas**<br>Angka polos $<100$ dikali `0.01` jika tidak memiliki suffix/Rp. | Pada input `"Kopi 50 di lantai 2"`, angka `50` ber-skor `0.5` dan `2` ber-skor `0.02`. Parser akan memilih `50` sebagai nominal transaksi (Rp 50), padahal angka tersebut adalah kuantitas. |

---

## 3. Parser Input Chat (`chatParser.ts`)

| No | Modul / Lokasi | Deskripsi Temuan | Masalah & Impact |
|---|---|---|---|
| **3.1** | `chatParser.ts` | **Klausa "Dari" Disangka Sumber Dana** *(perilaku lama, bukan potongan buta)*<br>Klausa `dari/via/pakai/pake/from X` dipakai sebagai sumber dana walau `X` adalah penjual/lokasi. Detail kecil pada contoh: kata kerja `beli` juga ikut terbuang, jadi hasilnya `"Nasi Goreng"` (bukan `"Beli Nasi Goreng"`). Ini lebih tepat disebut keterbatasan desain daripada bug eksekusi. | Diperbaiki: klausa hanya jadi sumber bila `X` dikenal (`detectKnownSource`); `"dari warung Pak Eko"` kini dipertahankan di deskripsi dan `source` tetap kosong. |
| **3.2** | `chatParser.ts` | **Pembersihan Kata + Angka Merusak Deskripsi Produk**<br>`desc.replace(/\s+\w+\s+\d{1,2}\s*$/ , '')` menghapus kombinasi kata + angka 1–2 digit di akhir string. | Input produk seperti `"Ayam Geprek Level 5"` atau `"Bakso Pak 2"` akan dipotong secara salah menjadi `"Ayam Geprek"` atau `"Bakso"`. |
| **3.3** | `chatParser.ts` | **Batas Lookback Nomor Referensi Terlalu Sempit**<br>`REF_LOOKBACK_RE` hanya mengecek 20 karakter sebelum angka (`text.slice(Math.max(0, m.index - 20), m.index)`). | Teks `"Nomor Referensi Pembayaran: 12345678"` memiliki panjang prefix $>20$ karakter, sehingga nomor referensi gagal di-skip dan masuk sebagai kandidat nominal. |
| **3.4** | `chatParser.ts` | **Tahun Terbaca Sebagai Nominal Pembayaran**<br>Angka tahun empat digit polos tanpa suffix/Rp dalam chat. | Teks seperti `"Beli baju 2026"` akan meloloskan angka `2026` sebagai amount = Rp 2.026. |

---

## 4. Parser Teks Struk/Resi OCR (`receiptParser.ts`)

| No | Modul / Lokasi | Deskripsi Temuan | Masalah & Impact |
|---|---|---|---|
| **4.1** | `receiptParser.ts` | **Celah `shouldSkip` pada Baris Referensi Ber-Rp**<br>Penyaringan menggunakan kondisi `if (isRefLine(line) && !rpRe.test(line)) return true;`. | Jika OCR membaca baris nomor referensi yang memuat teks `Rp` (misal `"No. Ref: Rp 982341234"`), kondisi `!rpRe.test(line)` bernilai `false` dan nomor referensi lolos penyaringan. |
| **4.2** | `receiptParser.ts` | **`normalizeAmountRaw` adalah Dead Code** *(koreksi: mekanisme temuan asli mustahil terjadi)*<br>Token nominal berasal dari regex `/\d[\d.,]*/` yang **wajib dimulai digit** dan hanya berisi digit/titik/koma. Huruf `O`/`l`/`I` tidak akan pernah masuk ke fungsi, jadi penggantian `O→0`, `l/I→1` tidak pernah aktif. Contoh `"TOTAL O.OO"`/`"INDRA"` di temuan asli keliru — teks berhuruf tak akan terbaca nominal. | Dampak asli tidak ada; temuan sebenarnya adalah **dead code** yang menyesatkan pembaca dan tidak berfungsi sebagai perbaikan OCR (misbaca `"1O00"` tetap terpotong jadi `"1"`). |
| **4.3** | `receiptParser.ts` | **Guard 80% di `extractAmount` Hampir Mustahil Tercapai** *(koreksi: contoh asli kontradiktif)*<br>Contoh asli (Rp 50.000 vs 100.000 polos) keliru: kandidat Rp 50.000 ber-skor `50.000 × 2,5 = 125.000` > `100.000`, jadi `pickBestAmount` justru memilih Rp 50.000 dan branch tak pernah masuk. | Branch `bestRp >= best.value * 0.8` praktis mati bila `best` polos (karena `best` terpilih berarti nilainya ≥ 2,5× nilai Rp mana pun). Masalah mendasar tumpang tindih dengan 2.1: magnitudo linear mendominasi sinyal. |
| **4.4** | `receiptParser.ts` | **Pemotongan Deskripsi `finalizeDesc` Terlalu Generik**<br>Memotong string deskripsi jika menemukan kata `' dari '`, `' pakai '`, `' pake '`, atau `' via '`. | Nama penerima/deskripsi resi seperti `"Nasi Goreng Dari Abang"` atau `"Toko Via"` akan terpotong secara tidak sengaja menjadi `"Nasi Goreng"` atau `"Toko"`. |

---

## 5. Pengolahan Tanggal (`chatParser.ts` & `receiptParser.ts`)

| No | Modul / Lokasi | Deskripsi Temuan | Masalah & Impact |
|---|---|---|---|
| **5.1** | `chatParser.ts` | **Validasi Tanggal Tidak Mengecek Jumlah Hari dalam Bulan**<br>`parseExplicitDate` hanya mengecek `1 <= d <= 31`. | Input `"tgl 31"` pada bulan Februari atau April menghasilkan format ISO yang tidak valid secara kalender (`2026-02-31`). |
| **5.2** | `receiptParser.ts` | **Gagal Ekstraksi Tanggal OCR Menempel Tanpa Spasi**<br>Regex tanggal resi `/(\d{1,2})\s*(Jan|...)\w*\s+(\d{4})/i` mewajibkan spasi sebelum tahun (`\s+`). | Tanggal hasil OCR yang menempel rapat seperti `"01Sep2026"` atau `"15Agustus2026"` gagal diekstraksi dan jatuh ke tanggal default (hari ini). |

---

## 6. Rekomendasi Perbaikan Skenario Uji (Test Coverage)

1. **Unit Test Spesifik per Rule Regex**: Buat *test suite* khusus untuk menguji edge cases nama produk (seperti `"Level 5"`), nama penjual (`"warung Pak Eko"`), dan variasi angka tahun.
2. **Uji Matrix Kombinasi OCR Struk**: Buat dataset uji berbasis teks OCR nyata dari berbagai bank/e-wallet di Indonesia yang mencakup format subtotal, admin, total, dan nomor referensi.
3. **Penyempurnaan Bobot Scoring**: Ubah rumus scoring pada `amountRank.ts` dari sistem pengali linear (`score = value * multiplier`) menjadi sistem skor kualitatif/tier berbasis poin independen dari besarnya nilai absolut `value`.

---

## 7. Status Implementasi

Dokumen ini diperiksa ulang terhadap kode (lihat catatan koreksi pada 4.2 dan 4.3). Seluruh item di bawah telah diimplementasikan dan diuji (`npm run typecheck` + `npm run test:unit` + `npm run lint`):

| No | Status | Catatan |
|---|---|---|
| 1.1 | ✅ | `SOURCES` diurutkan: sub-brand (`BCA Syariah`, `Mandiri Taspen`) mendahului induknya karena pencarian first-match. Test: `dari BCA Syariah` → `BCA Syariah`. |
| 1.2 | ✅ | `Dana` hanya dikenali saat ALL-CAPS `DANA`/`Dana` (nama resmi). Kata `dana` lowercase ("dana darurat") bukan e-wallet. `Kas`/`Tunai` sengaja dipertahankan sbg generic source (test lama `kopi 20rb kas` → `Kas` tetap berlaku). |
| 1.3 | ✅ | Pola OCBC `ocbc\s*níaga` → `ocbc\s*n[ií]aga` (toleran aksen). |
| 1.4 | ✅ | `\b` ditambahkan: `maybank`, `hsbc`, `dbs`, `icbc`, `citibank`, `sinarmas`, `taspen`. Test: sub-string `xmaybankx` tidak terdeteksi. |
| 2.1 | ✅ | `amountRank` diubah ke **tier-scoring** (Rp/suffix = tier 3, keyword = tier 2, polos wajar = tier 1, polos kecil/besar = tier 0); sinyal menang atas magnitudo, `value` hanya tiebreaker dalam tier yang sama. |
| 2.2 | ✅ | Konsekuensi tier-scoring: kuantitas polos (<100) di tier 0 → kalah dari nominal bersinyal maupun angka polos wajar. |
| 3.1 | ✅ | Klausa `dari/via/pakai X` hanya jadi sumber bila X adalah entitas yang dikenal (`detectKnownSource`); selain itu klausa dipertahankan di deskripsi & source tidak diisi. |
| 3.2 | ✅ | Penghapusan "kata + angka" di akhir deskripsi dibatasi ke kata lokasi (`lantai/lt/meja/...`); `"Level 5"`/`"Pak 2"` tidak terpotong. Angka polos 1–2 digit di akhir juga dipertahankan. |
| 3.3 | ✅ | Lookback referensi 20 → 80 karakter + token `referensi/nomor/nomer/akun/pembayaran`; label panjang `"Nomor Referensi Pembayaran: 12345678"` ikut di-skip. Catatan: `rekening` tetap di pola langsung (bukan rantai) agar `"bayar rekening listrik 50000"` terbaca nominal. |
| 3.4 | ✅ | Tahun 4 digit polos (1900–2099) di-skip di `extractCandidates`, kecuali kelipatan 100 (`"parkir 2000"` tetap nominal — beda dari resi yang selalu ber-Rp). |
| 4.1 | ✅ | Di `shouldSkip`, angka ≥5 digit tanpa desimal di baris ref di-skip walau baris memuat `Rp`. |
| 4.2 | ✅ | `normalizeAmountRaw` dihapus (dead code); teks berhuruf (O.OO/INDRA) tidak pernah jadi nominal — ditambah regression test. |
| 4.3 | ✅ | Guard 80% dihapus; `extractAmount` = `pickBestAmount(...).value`. Tier-scoring membuat kandidat bersinyal Rp selalu menang atas angka polos. |
| 4.4 | ✅ | `finalizeDesc` memotong di `dari/via/pakai/pake` HANYA bila sisa teks adalah sumber yang dikenal; `"Nasi Goreng Dari Abang"` tidak terpotong. |
| 5.1 | ✅ | `clampDayISO` baru di chatParser: `tgl 31`/`31/02/2026` di-clamp ke hari terakhir bulan (bukan ISO invalid). Juga dipakai receiptParser. |
| 5.2 | ✅ | Spasi sebelum tahun di regex tanggal dibuat opsional (`\s*`) di receiptParser → `01Sep2026`/`15Agustus2026` terbaca. |
| 6.1–6.3 | ✅ | Regression test ditambahkan di `chatParser.test.ts` & `receiptParser.test.ts` per item di atas. |
| 6.2 (dataset) | ✅ | Dataset OCR multi-bank terpusat: `tests/fixtures/ocr-receipts.ts` (16 fixture BCA, BRI, Mandiri, BSI, GoPay, DANA, OVO, ShopeePay, LinkAja, Jago, KAI) + driver `tests/unit/ocrDataset.test.ts`. |

---

## 8. Temuan Lanjutan — Hasil Audit Dataset OCR Multi-bank

Dataset di §6.2 dipakai untuk mengaudit format lintas bank di luar *happy path* test lama. Ditemukan & diperbaiki:

| No | Deskripsi Temuan | Perbaikan |
|---|---|---|
| 8.1 | **Baris Saldo menang atas nominal** (DANA/OVO: `Rp 250.000 … Saldo Rp 1.000.000` → nominal terpilih `1.000.000`). | `shouldSkip` membuang kandidat bila barisnya (atau baris sebelumnya) menyebut `saldo`. |
| 8.2 | **Baris pengirim `Dari <rekening> a.n. X` disangka sumber dana** (BCA: source jadi nomor rekening). | Klausa `dari/via/from` yang berisi angka tidak dipakai sbg source (itu info pengirim, bukan e-wallet sumber) → jatuh ke header/scan database. |
| 8.3 | **Penerima tak ter-ekstrak**: `Dikirim ke 0812… a.n. SITI AMINAH` dan `Ke 0812…\nNama: JOKO WIDODO` menghasilkan deskripsi generik. | Prioritas baris nama (`a.n.`/`Nama:`/`Atas nama`) di atas baris `Ke <no HP>` + ekspor nama penerima sebagai deskripsi. |
| 8.4 | **Nomor polos ≥5 digit tanpa `Rp` di-skip walau ada keyword** → `Jumlah Transfer 100000` jadi `null`. | Keyword `Total/Jumlah/Transfer` pada baris (atau sebelumnya) menandakan nominal, bukan nomor referensi. |
| 8.5 | **Label nama berbahasa Inggris tak dikenali** (BCA internasional `Beneficiary Name LUKY DIAN SUSANTI`, `Name: X`). | `NAME_CAPTURE_RE` memahami `Beneficiary/Account/Recipient Name`, `Name`, `Penerima`, `Nama`, `Atas Nama`, `a.n.` — bentuk `a.n.` wajib separator agar `ANGGIE/Antoni/DIAN` tak tertangkap. |
| 8.6 | **`NOTE_RE` longgar memilih baris sembarang** (`Transfer Successful`, `BANDUNG` cocok `a\.?\s*n\.?` pada substring "an") sehingga deskripsi jatuh ke baris tanggal/amount. | Deteksi "a.n." di `NOTE_RE` kini wajib diakhiri spasi + word boundary pada `nama`/`name`; merchant line (`Access By KAI`) lolos ke *fallback description*. |