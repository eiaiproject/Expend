import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useSheetHistory } from '../lib/useSheetHistory'

interface TutorialDialogProps {
  onClose: () => void
}

export function TutorialDialog({ onClose }: TutorialDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const close = useSheetHistory('tutorial', onClose)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="sheet tutorial"
      aria-labelledby="tutorial-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) close()
      }}
    >
      <article className="sheet-form">
        <header className="sheet-head">
          <hgroup>
            <h2 id="tutorial-title">Tutorial pengisian</h2>
            <p className="sheet-sub">Format chat, tanggal, nominal, dan bukti transfer</p>
          </hgroup>
          <button
            type="button"
            className="icon-btn"
            onClick={close}
            aria-label="Tutup tutorial"
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <section className="sheet-body tutorial-body">
          <section className="tutorial-section" aria-labelledby="tutorial-flow">
            <h3 id="tutorial-flow">Alur pengisian</h3>
            <ol className="tutorial-steps">
              <li>Tulis satu baris di kolom bawah, atau pilih bukti transfer.</li>
              <li>Periksa pratinjau. Semua field masih bisa diubah.</li>
              <li>Simpan. Nomor transaksi dibuat otomatis.</li>
            </ol>
          </section>

          <section className="tutorial-section" aria-labelledby="tutorial-format">
            <h3 id="tutorial-format">Format satu baris</h3>
            <p>Urutannya tetap supaya parser tidak salah membaca.</p>
            <dl className="format-list">
              <dt>Penerima</dt>
              <dd>Nama toko atau orang. Boleh mengandung angka, misalnya Mitra 10.</dd>
              <dt>Nominal</dt>
              <dd>Angka pengeluaran: 100000, 100.000, 50rb, atau 1,5jt.</dd>
              <dt>Sumber dana</dt>
              <dd>
                Mandiri, BCA, BRI, BNI, Jago, SeaBank, GoPay, OVO, DANA, ShopeePay,
                atau Tunai.
              </dd>
              <dt>Keterangan</dt>
              <dd>Opsional, ditulis paling akhir.</dd>
            </dl>
            <p className="tutorial-example">
              <code>Indomaret 100000 Mandiri belanja bulanan</code>
            </p>
          </section>

          <section className="tutorial-section" aria-labelledby="tutorial-date">
            <h3 id="tutorial-date">Tanggal</h3>
            <p>
              Tanpa tanggal, transaksi dicatat hari ini menurut WIB. Tanggal bisa ditulis
              di awal dengan 12/11, 12/11/2026, atau 2026-11-12. Tanggal di masa depan
              ditolak saat pratinjau.
            </p>
            <p className="tutorial-example">
              <code>12/11 Kopi Kenangan 25000 BCA 2 gelas</code>
            </p>
          </section>

          <section className="tutorial-section" aria-labelledby="tutorial-payee-number">
            <h3 id="tutorial-payee-number">Angka di nama penerima</h3>
            <p>
              Angka yang menjadi bagian nama tidak dibaca sebagai nominal. Nominal diambil
              dari angka yang berdiri tepat sebelum sumber dana.
            </p>
            <p className="tutorial-example">
              <code>Mitra 10 50000 BCA belanja bahan bangunan</code>
            </p>
            <p className="tutorial-result">
              Terbaca: penerima Mitra 10, nominal Rp 50.000, sumber BCA.
            </p>
          </section>

          <section className="tutorial-section" aria-labelledby="tutorial-receipt">
            <h3 id="tutorial-receipt">Bukti transfer</h3>
            <p>
              Tekan tombol gambar di kolom pengisian, lalu pilih bukti transfer dari
              galeri atau file. Livin/Mandiri, Jago, SeaBank, BCA, BRI, dan GoPay dikenali.
              Hasil OCR selalu masuk pratinjau untuk diperiksa.
            </p>
            <p>Gambar dibuang setelah transaksi disimpan.</p>
          </section>

          <section className="tutorial-section" aria-labelledby="tutorial-preview">
            <h3 id="tutorial-preview">Pratinjau dan nomor</h3>
            <ul className="tutorial-list">
              <li>Penerima, nominal, sumber dana, dan tanggal wajib terisi.</li>
              <li>Nomor transaksi dibuat otomatis, misalnya EXP-000001.</li>
              <li>Nomor transaksi yang dihapus bisa dipakai lagi.</li>
              <li>Transaksi yang sudah tersimpan bisa diubah atau dihapus.</li>
            </ul>
          </section>
        </section>

        <footer className="sheet-foot tutorial-foot">
          <button type="button" className="btn btn-primary" onClick={close}>
            Mengerti
          </button>
        </footer>
      </article>
    </dialog>
  )
}
