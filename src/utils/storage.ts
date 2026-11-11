export type StorageStatus = 'persisted' | 'best-effort' | 'unsupported';

/** Status saat ini tanpa meminta izin; aman dipanggil untuk tampilan Settings. */
export async function getStorageStatus(): Promise<StorageStatus> {
  try {
    if (!navigator.storage?.persisted) return 'unsupported';
    return (await navigator.storage.persisted()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}

/**
 * Minta browser mempertahankan IndexedDB dari eviction. Browser boleh menolak
 * (misalnya mode privat); kegagalan bukan alasan menggagalkan penyimpanan.
 */
export async function requestPersistentStorage(): Promise<StorageStatus> {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    if (await getStorageStatus() === 'persisted') return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}
