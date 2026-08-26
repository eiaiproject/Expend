/**
 * Guard navigasi wizard onboarding.
 * Step 1 menuntut nama dompet non-kosong sebelum boleh lanjut — mencegah
 * alur "selesai tanpa dompet" yang dulu menghasilkan app kosong (QA H1).
 */
export function canGoToStep(
  currentStep: number,
  values: { readonly walletName: string },
): boolean {
  if (currentStep !== 1) return true;
  return values.walletName.trim().length > 0;
}
