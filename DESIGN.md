# DESIGN.md

Arah dari PRD: hitam putih, modern, minimalis, dengan mode terang dan gelap.

Design Read: buku kas pribadi untuk satu pengguna di Indonesia, dibaca sebagai aplikasi mobile, dial ENERGY 1 / RHYTHM 2 / MOTION 1.

## Alasan keputusan

- **Shell aplikasi, bukan halaman web.** Layar penuh, header tipis, bottom tab bar, dan composer yang menempel di bawah. Alasannya: pencatatan terjadi berulang, jadi input harus selalu dalam jangkauan ibu jari dan tidak perlu menggulir ke atas.
- **Feed chat di layar Catat.** Transaksi tampil sebagai bubble rata kanan dengan nominal tebal dan pembatas hari. Alasannya: produk memang berbasis chat, sehingga riwayat terasa seperti percakapan, bukan tabel.
- **Satu kartu total terbalik di dasbor.** Hanya bidang itu yang berisi penuh di halaman. Alasannya: satu fokus per layar, dan aksen berupa inversi tanpa menambah warna.
- **Komposer dengan pratinjau langsung.** Hasil parse tampil sebagai satu baris kecil di bawah input. Alasannya: memberi umpan balik sebelum dialog dibuka, tanpa memindahkan fokus dari mengetik.
- **Grafik satu panel dengan segmented control.** Satu grafik besar yang bisa diganti periode, bukan tiga grafik kecil bertumpuk. Alasannya: di layar ponsel, satu grafik besar lebih terbaca dan bisa disentuh per batang.
- **Radius bertingkat.** Kontrol 12px, kartu 18 sampai 22px, sheet 26px di sisi atas. Alasannya: kedalaman terlihat dari radius, bukan dari semua elemen dibuat pill.
- **Bayangan hanya pada dua hal.** Composer dock dan bottom sheet. Alasannya: keduanya memang melayang di atas konten. Kartu dan baris memakai garis rambut 1px.
- **Palet monokrom.** PRD meminta hitam putih: kertas `#F4F2ED`, permukaan `#FFFFFF`, tinta `#14140F`, abu `#6B6B66`, garis `#D8D5CC`. Mode gelap: `#111110`, `#191918`, `#F2F0EA`, `#9C9A93`, `#2C2C29`.
- **Nominal monospace tabular.** Angka sejajar seperti kolom buku kas, dan nominal selalu jadi hal pertama yang terbaca di setiap baris.
- **Ikon Lucide.** Diminta pengguna, dipilih sesuai makna: `PenLine`, `List`, `ChartColumn`, `ImagePlus`, `ArrowUp`, `SlidersHorizontal`, `Search`, `Database`, `Download`, `Upload`, `Sun`, `Moon`, `ReceiptText`.
- **Motion hanya transisi state.** 140 sampai 180ms pada hover, tekan, dan buka sheet. Tidak ada scroll reveal karena tidak menambah informasi.

## Batasan yang disadari

- Ikon aplikasi masih placeholder teks, belum logo final.
- Data hanya di IndexedDB perangkat. Tidak ada sinkronisasi.
- Tombol kecil di dalam grafik mengikuti lebar batang, jadi area sentuh tidak selalu 44px. Alternatifnya adalah daftar angka di bawah grafik yang memakan ruang lebih besar.
