import 'fake-indexeddb/auto';

/**
 * jsdom belum mengimplementasikan `Blob.prototype.arrayBuffer` (semua browser
 * target sudah mendukungnya). Tanpa polyfill, kode produksi yang membaca header
 * file - `validateFileMagic` di utils/ocr - selalu jatuh ke catch dan terlihat
 * "menolak semua gambar" di test, padahal di browser normal.
 *
 * FileReader di sini bukan pilihan gaya: `Blob#arrayBuffer` yang jadi tujuan
 * aturan S7756 justru yang sedang dipolyfill, dan jsdom Blob tidak punya
 * `stream()`/`arrayBuffer()` sehingga `new Response(blob)` pun tidak bisa
 * membacanya.
 */
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('FileReader gagal membaca blob'));
      reader.readAsArrayBuffer(this); // NOSONAR - S7756: polyfill untuk Blob#arrayBuffer itu sendiri
    });
  };
}
