# Impor CSV Google Sheets (Expend)

Sumber yang didukung: **CSV hasil download Google Sheets** — Sheets
`File → Download → CSV`, atau file CSV dari perintah `/export` bot Telegram
(`pengeluaran-*.csv`). File `.xlsx` tidak didukung (tanpa dependensi baru).

## Cara pakai

1. Di Telegram: `/export semua` (atau `/export bulan`) → unduh file CSV.
   Atau di Sheets: `File → Download → Comma-separated values (.csv)`.
2. Di Expend: **Settings → Data → Impor file** → pilih file `.csv`.
3. Toast melaporkan hasil: `Berhasil mengimpor N transaksi (Sheets)`
   plus `M baris dilewati` bila ada baris rusak/duplikat.

## Aturan kolom

Hanya 5 kolom yang dipakai (posisi bebas, dicocokkan dari nama header):

| CSV Sheets | Expend | Aturan |
| --- | --- | --- |
| Tanggal | `date` | ISO `YYYY-MM-DD`, serial Excel (`46266.79`), atau `d MMM yyyy` / `D/M/YYYY`; gagal → baris di-skip |
| Penerima | `description` | wajib isi, maks 200 char, disimpan 80 char |
| Nominal | `amount` | `14.603` / `14,603` / `14603,0` / `Rp 25.000` → bulat `1..1.000.000.000.000` |
| Sumber Dana | `source` | dikenal → kanonis (`BSI`, `GoPay`…); kosong / `Belum diisi` / tak dikenal → **dihilangkan** (kosong) |
| Catatan | `note` | maks 200 char |

Kolom `ID`, `Input`, `Status`, `Dicatat Pada` **dibuang saat impor**
(tidak masuk DB). Baris `Status = Perlu dicek` ikut masuk dengan
`source` kosong. Header Expend sendiri (`Tanggal,Deskripsi,Jumlah,…`,
id/en) juga diterima.

## Batasan (selaras impor JSON)

- Maks 5 MB / 10.000 baris. Append-only + dedupe eksak
  (`deskripsi|nominal|tanggal|sumber|catatan`) terhadap file dan DB.
- Tanpa `ID`, edit 1 huruf di Sheets lalu impor ulang = duplikat.
  Itu harga dari kolom ID yang dibuang.
- 100% offline: parsing di memori perangkat (chunk async),
  tidak ada data yang keluar. Perhatian: CSV berisi nama/penerima
  asli — jangan commit file CSV ke repo.
