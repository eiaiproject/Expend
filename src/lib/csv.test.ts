import { describe, expect, it } from 'vitest'
import { CSV_HEADER, parseCsv, toCsv } from './csv'
import type { Transaction } from './db'

const row = {
  number: 'EXP-000001',
  date: '2026-01-05',
  payee: 'Indomaret, cabang "A"',
  amount: 100000,
  source: 'BCA',
  note: 'belanja, bulanan',
}

const transactions: Transaction[] = [{ ...row, id: 1, createdAt: 0 }]

describe('csv', () => {
  it('menulis BOM, header, dan sel berisi koma serta kutip', () => {
    const text = toCsv(transactions)
    expect(text.startsWith('\uFEFF')).toBe(true)
    expect(text).toContain(CSV_HEADER.join(','))
    expect(text).toContain('"Indomaret, cabang ""A"""')
  })

  it('membaca hasil export sendiri tanpa kehilangan data', () => {
    expect(parseCsv(toCsv(transactions))).toEqual({ rows: [row], errors: [] })
  })

  it('menolak file dengan header asing', () => {
    const result = parseCsv('tanggal,penerima,nominal\n2026-01-05,Indomaret,100000\n')
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0]).toContain('Header CSV tidak cocok')
  })

  it('menolak tanggal di masa depan', () => {
    const result = parseCsv(toCsv([{ ...row, date: '2999-01-01', id: 2, createdAt: 0 }]))
    expect(result.rows).toHaveLength(0)
    expect(result.errors.some((error) => error.includes('masa depan'))).toBe(true)
  })

  it('menolak nominal pecahan dan nomor ganda', () => {
    const text = toCsv([
      { ...row, amount: 100.5, id: 2, createdAt: 0 },
      { ...row, amount: 2000, id: 3, createdAt: 0 },
    ])
    const result = parseCsv(text)
    expect(result.errors.some((error) => error.includes('angka bulat'))).toBe(true)
    expect(result.errors.some((error) => error.includes('ganda'))).toBe(true)
  })

  it('menolak nominal di atas plafon draft', () => {
    const result = parseCsv(
      toCsv([{ ...row, amount: 1_000_000_000_000, id: 2, createdAt: 0 }]),
    )
    expect(result.rows).toHaveLength(0)
    expect(result.errors.some((error) => error.includes('terlalu besar'))).toBe(true)
  })

  it('menetralkan nilai berawalan formula dan mengembalikannya saat import', () => {
    const dangerous = {
      ...row,
      payee: '=SUM(A1:A2)',
      source: '+BCA',
      note: '@cmd',
      id: 4,
      createdAt: 0,
    }
    const text = toCsv([dangerous])
    expect(text).toContain("'=SUM(A1:A2)")
    expect(parseCsv(text).rows[0]).toMatchObject({
      payee: '=SUM(A1:A2)',
      source: '+BCA',
      note: '@cmd',
    })
  })
})
