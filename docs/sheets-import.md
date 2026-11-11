# Impor spreadsheet (CSV/XLSX)

Sumber yang didukung: **CSV Google Sheets**, CSV perintah `/export` bot Telegram,
dan file **XLSX** dengan sheet `Transaksi`. File `.xls` lama tidak didukung;
simpan ulang sebagai `.xlsx`.

## Cara pakai

1. Di Telegram: `/export semua` (atau `/export bulan`) lalu unduh CSV.
   Di Sheets: `File > Download > Comma-separated values (.csv)`.
   Atau gunakan file XLSX yang memiliki sheet `Transaksi`.
2. Di Expend: **Settings > Data > Impor file** lalu pilih file `.csv` atau `.xlsx`.
3. Toast melaporkan hasil: `Berhasil mengimpor N transaksi (spreadsheet)`
   plus `M baris dilewati` bila ada baris rusak atau duplikat.

## Aturan XLSX

- Hanya sheet bernama `Transaksi` yang dibaca. Sheet `Pengaturan`, `Log`, dan
  `Antrean` diabaikan, termasuk data operasional di dalamnya.
- Sel tanggal boleh berupa tanggal Excel asli atau string. Tanggal disimpan
  sebagai `YYYY-MM-DD` tanpa pergeseran zona waktu.
- Sel nominal boleh berupa angka atau teks dengan pemisah ribuan.
- Header dan aturan validasi sama dengan CSV di bawah. Sheet tanpa header
  lengkap ditolak, bukan diimpor sebagian.

## Aturan kolom

Hanya 5 kolom yang dipakai (posisi bebas, dicocokkan dari nama header):

| Spreadsheet | Expend | Aturan |
| --- | --- | --- |
| Tanggal | `date` | ISO `YYYY-MM-DD`, serial Excel (`46266.79`), atau `d MMM yyyy` / `D/M/YYYY`; gagal berarti baris di-skip |
| Penerima | `description` | wajib isi, maks 200 char, disimpan 80 char |
| Nominal | `amount` | `14.603` / `14,603` / `14603,0` / `Rp 25.000` menjadi bulat `1..1.000.000.000.000` |
| Sumber Dana | `source` | dikenal menjadi kanonis (`BSI`, `GoPay`, dan seterusnya); kosong, `Belum diisi`, atau tak dikenal dihilangkan |
| Catatan | `note` | maks 200 char |

Kolom `ID`, `Input`, `Status`, `Dicatat Pada` dibuang saat impor (tidak masuk
DB). Baris `Status = Perlu dicek` ikut masuk dengan `source` kosong. Header
Expend sendiri (`Tanggal,Deskripsi,Jumlah,...`, id/en) juga diterima.

## Batasan

- Maks 5 MB / 10.000 baris. Append-only + dedupe eksak
  (`deskripsi|nominal|tanggal|sumber|catatan`) terhadap file dan DB.
- Tanpa `ID`, edit 1 huruf di spreadsheet lalu impor ulang menghasilkan
  duplikat. Itu konsekuensi kolom ID yang dibuang.
- Parsing berjalan di memori perangkat dan tidak mengirim isi spreadsheet.
  File spreadsheet berisi nama dan transaksi asli, jadi jangan commit file
  pribadi ke repo.
