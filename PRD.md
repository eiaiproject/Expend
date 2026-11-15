project-name: Expend
version: 0.1.0

Expend adalah aplikasi pencatat pengeluaran yang cara mencatatnya berbasis chat dan membaca gambar bukti transfer dari bank (user yang upload) yang tujuannya adalah memudahkan user dalam mencatat seluruh pengeluaran pribadinya.

spesifikasi:
  project berbentuk PWA yang akan dideploy di cloudflare pages. jadi tentukan tech stack yang sesuai;
  pencatatan berbasis chat yang terstruktur agar parser selalu akurat dengan format yang selalu sama: [penerima] [nominal] [sumber dana] [keterangan tambahan (opsional)]. contoh Indomaret 100000 Mandiri belanja bulanan. jika pada penerima terdapat angka, contoh: Mitra 10 50000 BCA belanja bahan bangunan maka angka 10 bukan nominal karena merupakan bagian dari nama penerima. untuk tanggal, default hari ini pada WIB;
  memiliki fitur upload bukti transfer dan otomatis akan mencatat juga sesuai format [tanggal] [penerima] [nominal] [sumber dana] [keterangan tambahan (jika ada)]. OCR tidak membaca selain format yang diminta tersebut. file OCR (tesseract) sudah tersedia yang sudah berisi "aturan" dari beberapa bank;
  baik dari chat ataupun upload bukti, akan keluar pratinjau yang bisa diedit sebelum menjadi transaksi;
  setiap input punya nomor transaksi uniknya;
  ada fitur sortir dan filter;
  tema warna hitam putih modern dan minimalis. ada fitur dark/light mode;
  punya fitur export csv yang punya kolom [nomor transaksi unik] [tanggal] [penerima] [nominal] [sumber dana] [keterangan tambahan];
