import { describe, expect, it } from 'vitest'
import { HIDDEN_AMOUNT, formatIDR, parseAmount } from './money'

describe('parseAmount', () => {
  it.each([
    ['100000', 100000],
    ['100.000', 100000],
    ['1.500.000', 1_500_000],
    ['Rp 25.000', 25000],
    ['50rb', 50000],
    ['50k', 50000],
    ['1,5jt', 1_500_000],
    ['2juta', 2_000_000],
    ['50,500.00', 50500],
  ])('membaca %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })

  it('mengembalikan null untuk teks biasa', () => {
    expect(parseAmount('makan')).toBeNull()
  })
})

describe('formatIDR', () => {
  it('menyembunyikan nominal dengan lima titik', () => {
    expect(formatIDR(125000, true)).toBe('•••••')
    expect(HIDDEN_AMOUNT).toHaveLength(5)
  })

  it('tetap memformat nominal saat terlihat', () => {
    expect(formatIDR(125000)).toBe('Rp 125.000')
  })
})
