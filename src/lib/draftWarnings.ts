export interface DraftWarningValues {
  date: string
  initialDate: string
  payee: string
  amount: number | null
  source: string
}

/**
 * Peringatan parser hanya relevan selama field terkait masih kosong atau
 * tanggal masih memakai nilai cadangan. Peringatan yang tidak terkait field
 * (misalnya format bank tidak dikenali) selalu ditampilkan.
 */
export function visibleWarnings(
  warnings: string[],
  values: DraftWarningValues,
): string[] {
  return warnings.filter((warning) => {
    if (warning.startsWith('Penerima')) return values.payee.trim().length === 0
    if (warning.startsWith('Nominal')) return values.amount === null
    if (warning.startsWith('Sumber dana')) return values.source.trim().length === 0
    if (warning.startsWith('Tanggal')) return values.date === values.initialDate
    return true
  })
}
