import { describe, expect, it } from 'vitest';
import { canGoToStep } from '../../src/utils/onboardingUtils';

describe('canGoToStep', () => {
  it('step 1 -> 2 diblokir saat nama dompet kosong/whitespace', () => {
    expect(canGoToStep(1, { walletName: '' })).toBe(false);
    expect(canGoToStep(1, { walletName: '   ' })).toBe(false);
  });
  it('step 1 -> 2 lolos saat nama terisi', () => {
    expect(canGoToStep(1, { walletName: 'BCA' })).toBe(true);
  });
  it('step >= 2 selalu boleh lanjut', () => {
    expect(canGoToStep(2, { walletName: '' })).toBe(true);
    expect(canGoToStep(3, { walletName: '' })).toBe(true);
  });
});
