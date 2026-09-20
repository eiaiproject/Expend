import { db, type ChatMessage } from '../db/db';

/**
 * Batas riwayat chat yang disimpan di IndexedDB. UI-nya sendiri sudah
 * dipaginate (50 pesan sekali muat), tetapi tabelnya sebelumnya tumbuh selamanya:
 * setiap upload bukti dan tiap transaksi menyimpan pesan, jadi setelah ribuan
 * transaksi export/backup ikut membengkak tanpa manfaat.
 */
const MAX_CHAT_MESSAGES = 500;

/**
 * Buang pesan tertua hingga tersisa MAX_CHAT_MESSAGES. Dijalankan setelah pesan
 * baru ditulis dan hanya menyentuh kelebihannya, jadi biayanya tetap O(kelebihan)
 * - bukan memindai tabel tiap kali. Satu `count()` per pesan adalah harga kecil
 * untuk kebijakan retensi yang deterministik (bisa diuji tanpa menunggu timer).
 */
async function pruneChatHistory(): Promise<void> {
  try {
    const total = await db.chatMessages.count();
    const excess = total - MAX_CHAT_MESSAGES;
    if (excess <= 0) return;
    // `createdAt` ter-index: ambil `excess` pesan paling tua, lalu hapus.
    const oldest = await db.chatMessages.orderBy('createdAt').limit(excess).toArray();
    const ids = oldest.map((m) => m.id).filter((id): id is number => typeof id === 'number');
    if (ids.length > 0) await db.chatMessages.bulkDelete(ids);
  } catch {
    // Housekeeping: kegagalan memangkas tidak boleh menggagalkan penyimpanan.
  }
}

/**
 * Satu-satunya jalur tulis pesan chat, supaya kebijakan retensi tidak bisa
 * terlupa di satu call site pun.
 */
export async function addChatMessage(msg: Omit<ChatMessage, 'id'>): Promise<void> {
  await db.chatMessages.add(msg as ChatMessage);
  await pruneChatHistory();
}
