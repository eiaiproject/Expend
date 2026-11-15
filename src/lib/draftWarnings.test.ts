import { describe, expect, it } from 'vitest'
import { visibleWarnings } from './draftWarnings'

const warnings = [
  'Format bank belum dikenali. Periksa semua field sebelum menyimpan.',
  'Tanggal tidak terbaca, dipakai hari ini.',
  'Penerima tidak terbaca. Isi manual.',
  'Nominal tidak terbaca. Isi manual.',
  'Sumber dana tidak terbaca. Pilih manual.',
]

describe('visibleWarnings', () => {
  it('menampilkan semua peringatan selama field belum diperbaiki', () => {
    expect(
      visibleWarnings(warnings, {
        date: '2026-11-15',
        initialDate: '2026-11-15',
        payee: '',
        amount: null,
        source: '',
      }),
    ).toEqual(warnings)
  })

  it('menyembunyikan peringatan field yang sudah diisi dan tanggal yang diubah', () => {
    expect(
      visibleWarnings(warnings, {
        date: '2026-11-10',
        initialDate: '2026-11-15',
        payee: 'Toko Maju',
        amount: 50000,
        source: 'BCA',
      }),
    ).toEqual([warnings[0]])
  })

  it('tetap menampilkan peringatan bank yang tidak dikenali', () => {
    expect(
      visibleWarnings([warnings[0]], {
        date: '2026-11-15',
        initialDate: '2026-11-15',
        payee: 'Toko Maju',
        amount: 50000,
        source: 'BCA',
      }),
    ).toEqual([warnings[0]])
  })
})
