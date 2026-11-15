import { describe, expect, it } from 'vitest'
import { parseReceipt } from './receiptParser'

const today = '2026-11-15'

describe('parseReceipt', () => {
  it('membaca bukti BCA yang dikenali', () => {
    const result = parseReceipt(
      [
        'BCA',
        'TRANSFER BERHASIL',
        'Tanggal 12 Nov 2026',
        'Beneficiary Name',
        'INDOMARET',
        'Transfer Amount',
        'Rp 100.000',
        'Source of Fund',
        'BCA',
        'Berita Transfer',
        'belanja bulanan',
      ].join('\n'),
      today,
    )

    expect(result.bank).toBe('bca')
    expect(result.date).toBe('2026-11-12')
    expect(result.payee).toBe('INDOMARET')
    expect(result.amount).toBe(100000)
    expect(result.source).toBe('BCA')
    expect(result.note).toBe('belanja bulanan')
  })

  it('mengambil field dari format bank yang belum dikenali', () => {
    const result = parseReceipt(
      [
        'Transfer Berhasil',
        'Tanggal 12/11/26',
        'Penerima: Mitra 10',
        'Nominal: Rp 50.000',
        'Sumber Dana: BCA',
        'Keterangan: belanja bahan bangunan',
      ].join('\n'),
      today,
    )

    expect(result.bank).toBeNull()
    expect(result.date).toBe('2026-11-12')
    expect(result.payee).toBe('Mitra 10')
    expect(result.amount).toBe(50000)
    expect(result.source).toBe('BCA')
    expect(result.note).toBe('belanja bahan bangunan')
    expect(result.warnings).toEqual([
      'Format bank belum dikenali. Periksa semua field sebelum menyimpan.',
    ])
  })

  it('tidak menganggap Total Transaksi sebagai penanda Mandiri', () => {
    const result = parseReceipt(
      [
        'Transfer Berhasil',
        'Tanggal 12 Nov 2026',
        'Penerima: Toko Maju',
        'Total Transaksi Rp 50.000',
        'Sumber Dana: BCA',
      ].join('\n'),
      today,
    )
    expect(result.bank).toBeNull()
    expect(result.payee).toBe('Toko Maju')
    expect(result.amount).toBe(50000)
    expect(result.source).toBe('BCA')
    expect(result.warnings).toContain(
      'Format bank belum dikenali. Periksa semua field sebelum menyimpan.',
    )
  })

  it('menebak penerima dari baris nama saat label tidak ada', () => {
    const result = parseReceipt(
      ['BANK SINAR', 'TRANSFER BERHASIL', '13 November 2026', 'TOKO MAKMUR', 'Rp 75.000', 'BCA'].join(
        '\n',
      ),
      today,
    )

    expect(result.date).toBe('2026-11-13')
    expect(result.payee).toBe('TOKO MAKMUR')
    expect(result.amount).toBe(75000)
    expect(result.source).toBe('BCA')
  })

  it('membaca nilai label yang berada di baris berikutnya', () => {
    const result = parseReceipt(
      [
        'Transfer',
        'Tanggal 01/02/2026',
        'Penerima',
        'Andi Wijaya',
        'Nominal',
        'Rp 20.000',
        'Sumber Dana',
        'Tunai',
      ].join('\n'),
      today,
    )

    expect(result.date).toBe('2026-02-01')
    expect(result.payee).toBe('Andi Wijaya')
    expect(result.amount).toBe(20000)
    expect(result.source).toBe('Tunai')
  })

  it('memberi peringatan ketika nominal tidak ditemukan', () => {
    const result = parseReceipt('Transfer Berhasil\nPenerima: Andi\nSumber Dana: BCA', today)
    expect(result.amount).toBeNull()
    expect(result.warnings).toContain('Nominal tidak terbaca. Isi manual.')
  })

  it('membaca nama Jago setelah label Ke walau ada baris bank', () => {
    const result = parseReceipt(
      ['jago', 'Transfer Berhasil', 'Ke', 'Bank BCA', 'Budi Santoso', 'Rp 100.000'].join('\n'),
      today,
    )
    expect(result.bank).toBe('jago')
    expect(result.payee).toBe('Budi Santoso')
    expect(result.amount).toBe(100000)
    expect(result.source).toBe('Jago')
  })

  it('membaca nama Jago pada baris yang sama dengan label Ke', () => {
    const result = parseReceipt(
      ['jago', 'Transfer Berhasil', 'Ke Budi Santoso', 'Rp 100.000'].join('\n'),
      today,
    )
    expect(result.payee).toBe('Budi Santoso')
  })

  it('tidak memakai status sebagai nama Jago saat label tidak ada', () => {
    const result = parseReceipt(
      ['jago', 'Transfer Berhasil', 'Budi Santoso', 'Rp 100.000'].join('\n'),
      today,
    )
    expect(result.payee).toBe('Budi Santoso')
  })

  it('membaca merchant Jago tanpa mengambil status pembayaran', () => {
    const result = parseReceipt(
      ['jago', 'Pembayaran Berhasil', 'Merchant', 'Toko Maju', 'Rp 50.000'].join('\n'),
      today,
    )
    expect(result.payee).toBe('Toko Maju')
    expect(result.amount).toBe(50000)
  })

  it('membaca label Tujuan pada bukti Jago', () => {
    const result = parseReceipt(
      ['jago', 'Transfer Berhasil', 'Tujuan', 'Bank Mandiri', 'Siti Aminah', 'Rp 75.000'].join(
        '\n',
      ),
      today,
    )
    expect(result.payee).toBe('Siti Aminah')
    expect(result.amount).toBe(75000)
  })

  it('memakai nama sebelum label Ke saat nama tidak ada setelahnya', () => {
    const result = parseReceipt(
      ['jago', 'Transfer Berhasil', 'Budi Santoso', 'Ke', 'Bank Jago', 'Rp 100.000'].join('\n'),
      today,
    )
    expect(result.payee).toBe('Budi Santoso')
  })

  it('melewati baris bank pada format umum setelah label Ke', () => {
    const result = parseReceipt(
      [
        'Transfer Berhasil',
        'Ke',
        'Bank BCA',
        'Toko Maju',
        'Rp 50.000',
        'Sumber Dana: BCA',
      ].join('\n'),
      today,
    )
    expect(result.bank).toBeNull()
    expect(result.payee).toBe('Toko Maju')
    expect(result.amount).toBe(50000)
    expect(result.source).toBe('BCA')
  })

  it('membaca merchant QR Jago dari teks OCR asli tanpa label', () => {
    const result = parseReceipt(
      [
        'QR MITRA10 SIDOARJO ©',
        'Rp921.868',
        '261114-CDWT-RFX8JZ Sukses',
        'ANGGIE IRAWAN',
        'Jago 109581096081',
        '109581096081',
        '14 Nov 2026, 11:07 WIB',
        'BNI',
        'Gratis',
        '9360000915003130075',
        '9360054219581096088',
        '06259722',
        'AAAAAAAHOYEI',
        'Ada pertanyaan?',
        'Hubungi Tanya Jago 24/7',
      ].join('\n'),
      today,
    )
    expect(result.bank).toBe('jago')
    expect(result.payee).toBe('MITRA10 SIDOARJO')
    expect(result.amount).toBe(921868)
    expect(result.date).toBe('2026-11-14')
    expect(result.source).toBe('Jago')
  })

  it('membaca tanggal BCA yang menempel pada nama bulan', () => {
    const result = parseReceipt(
      [
        'BCA',
        'Transfer Successful',
        '01Nov 2026 09:01:54',
        'IDR 50,500.00',
        'Beneficiary Name LUKY DIAN SUSANTI',
        'Beneficiary Account 555-514 - 5001',
        'Transaction Type Transfer to BCA',
        'Source of Fund 200 - 5** - **92',
        'Transfer Amount IDR 50,500.00',
        'Reference No. 9527120261101090154',
      ].join('\n'),
      today,
    )
    expect(result.bank).toBe('bca')
    expect(result.payee).toBe('LUKY DIAN SUSANTI')
    expect(result.amount).toBe(50500)
    expect(result.date).toBe('2026-11-01')
    expect(result.source).toBe('BCA')
  })

  it('membaca penerima dan tanggal GoPay dari teks OCR asli', () => {
    const result = parseReceipt(
      [
        '@ gopay',
        'Rp3.178.758',
        'Ditransfer ke ANGGIE IRAWAN',
        'Jago 109581096081',
        'Rincian transaksi',
        'Status Selesai',
        'Metode pembayaran Tabungan by Jago',
        'Waktu 12:06',
        'Tanggal O1Nov 2026',
        'Jumlah Rp3.178.758',
        'Total Rp3.178.758',
      ].join('\n'),
      today,
    )
    expect(result.bank).toBe('gopay')
    expect(result.payee).toBe('ANGGIE IRAWAN')
    expect(result.amount).toBe(3178758)
    expect(result.date).toBe('2026-11-01')
    expect(result.source).toBe('GoPay')
  })

  it('menebak penerima Mandiri saat label Penerima tidak terbaca', () => {
    const result = parseReceipt(
      [
        '( LJ LJ 9',
        'by mandiri',
        'Transfer Berhasil!',
        'WAHYU HIDAYAT',
        'Bank Mandiri - >>........ 2103',
        'Total Transaksi Rp 60.000',
        'ANGGIE IRAWAN',
        'Bank Mandiri - >>........ 7408',
      ].join('\n'),
      today,
    )
    expect(result.bank).toBe('mandiri')
    expect(result.payee).toBe('WAHYU HIDAYAT')
    expect(result.amount).toBe(60000)
    expect(result.date).toBe(today)
    expect(result.source).toBe('Mandiri')
  })

  it('memakai nominal berlabel dan membersihkan ikon pada penerima SeaBank', () => {
    const result = parseReceipt(
      [
        '(s) SeaBank',
        'Bukti Transaksi',
        'Rp 97.760',
        'Dari oO Anggie Irawan',
        '@ SeaBank: ******+x29Qg',
        'Ke Oo Shopee',
        'Username: a.irwn',
        'Jumlah Transfer Rp 57.760',
        'No. Transaksi 2026111443500860875395611',
        'Waktu Transaksi 14 Nov 2026, 18:24',
      ].join('\n'),
      today,
    )
    expect(result.bank).toBe('seabank')
    expect(result.payee).toBe('Shopee')
    expect(result.amount).toBe(57760)
    expect(result.date).toBe('2026-11-14')
    expect(result.source).toBe('SeaBank')
  })

  it('tidak mendeteksi BCA sebagai Jago saat bank tujuan ada di baris kedua', () => {
    const result = parseReceipt(
      [
        'BCA',
        'Bank Jago',
        'TRANSFER BERHASIL',
        'Beneficiary Name',
        'Budi Santoso',
        'Transfer Amount',
        'Rp 100.000',
        'Source of Fund',
        'BCA',
      ].join('\n'),
      today,
    )
    expect(result.bank).toBe('bca')
    expect(result.payee).toBe('Budi Santoso')
  })

  it('tetap memakai parser BCA saat bank tujuan adalah Jago', () => {
    const result = parseReceipt(
      [
        'BCA',
        'TRANSFER BERHASIL',
        'Tanggal 12 Nov 2026',
        'Beneficiary Name',
        'Budi Santoso',
        'Bank Tujuan',
        'Bank Jago',
        'Transfer Amount',
        'Rp 100.000',
        'Source of Fund',
        'BCA',
      ].join('\n'),
      today,
    )
    expect(result.bank).toBe('bca')
    expect(result.payee).toBe('Budi Santoso')
    expect(result.source).toBe('BCA')
  })
})
