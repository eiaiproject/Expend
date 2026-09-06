import { describe, it, expect } from 'vitest';
import { buildInfo } from '../../src/utils/buildInfo';

describe('buildInfo (versioning per-commit)', () => {
  it('fallback aman di luar vite build', () => {
    const info = buildInfo();
    // Di vitest, define __APP_* tidak ada → fallback deterministik.
    expect(info.version).toBe('0.0.0');
    expect(info.commit).toBe('dev');
    expect(info.date).toBe('');
  });
});
