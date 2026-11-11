# Model Ancaman Expend

Dokumen ini menjelaskan aset, aktor, trust boundary, dan risiko yang diterima.
Reviu berikutnya dilakukan saat arsitektur penyimpanan atau alur impor berubah.

## Aset

- Riwayat transaksi, catatan, sumber dana, dan tanggal di IndexedDB.
- Berkas backup JSON/CSV yang diunduh pengguna.
- Gambar bukti transaksi yang diproses sementara untuk OCR.
- API key BYOK dan konfigurasi endpoint AI yang disimpan di browser.
- Gambar bukti yang dikirim ke penyedia AI pihak ketiga saat BYOK aktif.
- Kode aplikasi dan aset OCR yang disajikan dari origin sendiri.

## Aktor dan trust boundary

1. Pengguna perangkat. Dianggap memiliki akses penuh ke browser dan sistem operasi.
2. Penyerang lokal dengan akses ke profil browser atau berkas backup.
3. Situs pihak ketiga yang mencoba membaca data lewat XSS, clickjacking, atau cache.
4. Pemasok dependency dan aset OCR.
5. Operator hosting statis (Cloudflare Pages) yang menyajikan bundle.
6. Penyedia AI yang dipilih pengguna saat BYOK aktif.

Tidak ada server aplikasi, akun, sinkronisasi cloud, atau telemetry. Integrasi
AI bersifat opsional dan memanggil endpoint pihak ketiga langsung dari browser.
Batas kepercayaan utama berada di antara halaman dan IndexedDB, antara pengguna
dan berkas backup yang mereka bagikan, serta antara browser dan penyedia AI
ketika fitur tersebut dikonfigurasi.

## Ancaman dan mitigasi

| Ancaman | Dampak | Mitigasi saat ini |
|---|---|---|
| XSS membaca IndexedDB | Data transaksi bocor | React escaping, allowlist impor, CSP tanpa inline script, dependency review |
| Clickjacking | Pengguna menekan aksi destruktif | `frame-ancestors 'none'`, `X-Frame-Options: DENY` |
| Cache share bocor | Gambar bukti terbaca sesi berikutnya | Cache dibersihkan setelah diproses, termasuk jalur error |
| Gambar decompression bomb | Tab kehabisan memori | Batas 10 MB dan 40 MP sebelum decode penuh |
| Impor JSON berbahaya | Prototype pollution atau formula injection | Allowlist field, validasi tipe, sanitasi CSV, batas 5 MB/10.000 item |
| Dependency compromise | Eksekusi kode di build atau runtime | Lockfile, audit, secret scan, CodeQL, aset OCR checksum |
| Kehilangan data perangkat | Riwayat hilang | Backup JSON, `navigator.storage.persist()`, status penyimpanan di Settings |
| Akses fisik ke perangkat | Data terbaca | Risiko diterima; tidak ada enkripsi at-rest |
| XSS membaca API key BYOK | Kredensial AI dicuri | Key hanya di `localStorage`, tidak pernah dicatat/diekspor, CSP mempersempit eksekusi script, dan key dapat diputus kapan saja |
| Gambar bukti dikirim ke penyedia AI | Data transaksi keluar dari perangkat | AI hanya aktif setelah pengguna mengisi endpoint dan key; UI menjelaskan pengiriman gambar; fallback lokal tetap tersedia setelah AI diputus |
| Penyedia AI menyimpan data | Retensi di luar kendali Expend | Pengguna memilih penyedia dan kebijakannya; dokumentasi menyatakan bahwa gambar diproses pihak ketiga saat AI aktif |

## Risiko yang diterima

- **Data at-rest tidak dienkripsi.** Enkripsi aplikasi tanpa kunci yang aman
  hanya memindahkan masalah: kunci harus disimpan di perangkat yang sama.
  Pengguna yang membutuhkan enkripsi harus memakai enkripsi disk sistem operasi.
  Opsi backup terenkripsi dengan passphrase dicatat sebagai backlog, bukan
  syarat rilis saat ini.
- **XSS residual.** CSP dan escaping menurunkan risiko, tetapi dependency baru
  atau `dangerouslySetInnerHTML` di masa depan dapat membuka kembali. Setiap
  penggunaan HTML mentah wajib melalui reviu.
- **Akses operator hosting.** Operator dapat mengganti bundle saat penyajian.
  Integritas build dijaga lewat CI, lockfile, dan review commit; tidak ada
  mekanisme SRI untuk dokumen HTML utama.
- **Retensi penyedia AI.** Saat BYOK aktif, gambar bukti dan hasil ekstraksi
  dapat diproses atau disimpan sesuai kebijakan penyedia. Expend tidak dapat
  menjamin penghapusan di sisi penyedia. Pengguna yang membutuhkan pemrosesan
  penuh di perangkat harus memutus AI dan memakai OCR lokal.
- **API key di localStorage.** Key dapat dibaca oleh script same-origin yang
  berhasil mengeksekusi XSS. Ini diterima sebagai konsekuensi BYOK tanpa backend;
  key tidak dimasukkan ke backup dan dapat dirotasi dari penyedia.

## Batas dan reviu

- Model ini tidak mencakup serangan fisik tingkat lanjut, malware dengan akses
  ke memori browser, atau kompromi penuh sistem operasi.
- Secret scanning, CodeQL, dan audit dependency berjalan di CI.
- Reviu model ancaman dilakukan minimal setiap rilis minor atau saat menambah
  integrasi pihak ketiga.
