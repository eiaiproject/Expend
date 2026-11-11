import { describe, it, expect, afterEach, vi } from 'vitest';
import { getStorageStatus, requestPersistentStorage } from '../../src/utils/storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage status', () => {
  it('mengembalikan unsupported bila API tidak ada', async () => {
    vi.stubGlobal('navigator', {});
    expect(await getStorageStatus()).toBe('unsupported');
    expect(await requestPersistentStorage()).toBe('unsupported');
  });

  it('mendeteksi status persisted tanpa meminta ulang', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true), persist } });
    expect(await getStorageStatus()).toBe('persisted');
    expect(await requestPersistentStorage()).toBe('persisted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('meminta persist dan mengembalikan best-effort bila ditolak', async () => {
    vi.stubGlobal('navigator', {
      storage: { persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) },
    });
    expect(await requestPersistentStorage()).toBe('best-effort');
  });

  it('menangani error API sebagai best-effort', async () => {
    vi.stubGlobal('navigator', {
      storage: { persisted: vi.fn().mockRejectedValue(new Error('nope')), persist: vi.fn() },
    });
    expect(await getStorageStatus()).toBe('best-effort');
    expect(await requestPersistentStorage()).toBe('best-effort');
  });
});
