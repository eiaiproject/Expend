import { describe, expect, it } from 'vitest'
import { parseChat, validateDraft } from './chatParser'

const today = '2026-11-14'

describe('parseChat', () => {
  it('membaca format dasar', () => {
    const draft = parseChat('Indomaret 100000 Mandiri belanja bulanan', today)
    expect(draft.payee).toBe('Indomaret')
    expect(draft.amount).toBe(100000)
    expect(draft.source).toBe('Mandiri')
    expect(draft.note).toBe('belanja bulanan')
    expect(draft.date).toBe(today)
    expect(draft.warnings).toEqual([])
  })

  it('tidak salah membaca angka yang bagian dari nama penerima', () => {
    const draft = parseChat('Mitra 10 50000 BCA belanja bahan bangunan', today)
    expect(draft.payee).toBe('Mitra 10')
    expect(draft.amount).toBe(50000)
    expect(draft.source).toBe('BCA')
  })

  it('membaca tanggal di depan dengan tafsiran DD/MM', () => {
    const draft = parseChat('12/11 Kopi Kenangan 25000 BCA 2 gelas', today)
    expect(draft.date).toBe('2026-11-12')
    expect(draft.payee).toBe('Kopi Kenangan')
    expect(draft.note).toBe('2 gelas')
  })

  it('membaca tanggal ISO di depan', () => {
    const draft = parseChat('2026-11-03 Parkir 5000 Tunai', today)
    expect(draft.date).toBe('2026-11-03')
    expect(draft.source).toBe('Tunai')
  })

  it('mendukung singkatan nominal yang menempel', () => {
    expect(parseChat('Bakso 50rb BCA makan siang', today).amount).toBe(50000)
    expect(parseChat('Sewa 1,5jt Mandiri kos', today).amount).toBe(1_500_000)
    expect(parseChat('Listrik 2juta BCA bayar', today).amount).toBe(2_000_000)
  })

  it('mendukung singkatan nominal yang dipisah spasi', () => {
    const draft = parseChat('Bakso 50 rb BCA makan siang', today)
    expect(draft.amount).toBe(50000)
    expect(draft.payee).toBe('Bakso')
  })

  it('mendukung awalan Rp terpisah', () => {
    const draft = parseChat('Bensin Rp 50000 BCA', today)
    expect(draft.amount).toBe(50000)
    expect(draft.payee).toBe('Bensin')
  })

  it('menormalkan alias sumber dana', () => {
    expect(parseChat('Kopi 25000 livin pagi', today).source).toBe('Mandiri')
    expect(parseChat('Belanja 120000 shopeepay baju', today).source).toBe('ShopeePay')
  })

  it('membaca alias sumber tiga kata tanpa menyisakannya di keterangan', () => {
    const draft = parseChat('Kopi 25000 livin by mandiri pagi', today)
    expect(draft.payee).toBe('Kopi')
    expect(draft.amount).toBe(25000)
    expect(draft.source).toBe('Mandiri')
    expect(draft.note).toBe('pagi')
  })

  it('menandai field wajib yang belum terdeteksi', () => {
    const draft = parseChat('100000', today)
    expect(draft.amount).toBe(100000)
    expect(draft.payee).toBe('')
    expect(draft.warnings.length).toBeGreaterThan(0)
    expect(validateDraft(draft, today).payee).toBeDefined()
  })

  it('menolak tanggal masa depan saat validasi', () => {
    const draft = parseChat('20/11 Indomaret 100000 BCA', today)
    expect(draft.date).toBe('2026-11-20')
    expect(validateDraft(draft, today).date).toBeDefined()
  })

  it('memakai hari ini ketika tanggal tidak valid', () => {
    const draft = parseChat('31/02 Indomaret 100000 BCA', today)
    expect(draft.date).toBe(today)
    expect(draft.warnings[0]).toContain('Tanggal tidak dikenali')
  })

  it('mengabaikan angka kecil yang bukan nominal', () => {
    const draft = parseChat('Mitra 10 belanja Mandiri', today)
    expect(draft.amount).toBeNull()
    expect(draft.source).toBe('Mandiri')
  })
})
