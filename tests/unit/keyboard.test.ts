import { describe, it, expect } from 'vitest';
import { isEditableElement, keyboardInsetPx } from '../../src/utils/keyboard';

describe('keyboardInsetPx (anti composer nyangkut)', () => {
  it('inset = selisih viewport saat editing', () => {
    expect(keyboardInsetPx(839, 539, 0, true)).toBe(300);
  });
  it('nol saat keyboard turun', () => {
    expect(keyboardInsetPx(839, 839, 0, true)).toBe(0);
  });
  it('dipaksa nol bila tidak ada yang fokus (meski metrik basi)', () => {
    expect(keyboardInsetPx(839, 539, 0, false)).toBe(0);
  });
  it('dijepit tidak negatif', () => {
    expect(keyboardInsetPx(500, 800, 0, true)).toBe(0);
  });
  it('memperhitungkan offsetTop', () => {
    expect(keyboardInsetPx(839, 500, 39, true)).toBe(300);
  });
});

describe('isEditableElement', () => {
  it('textarea dan input teks = editable', () => {
    const ta = document.createElement('textarea');
    const input = document.createElement('input');
    expect(isEditableElement(ta)).toBe(true);
    expect(isEditableElement(input)).toBe(true);
  });
  it('input file dan null = bukan editable', () => {
    const file = document.createElement('input');
    file.type = 'file';
    expect(isEditableElement(file)).toBe(false);
    expect(isEditableElement(null)).toBe(false);
    expect(isEditableElement(document.createElement('div'))).toBe(false);
  });
});
