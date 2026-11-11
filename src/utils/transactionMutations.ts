import { db, type Transaction } from '../db/db';

export type TransactionChanges = Pick<Transaction, 'description' | 'amount' | 'date' | 'source' | 'note'>;

function nowISO(at?: string): string {
  return at ?? new Date().toISOString();
}

/**
 * Edit transaksi dan simpan snapshot sebelum perubahan ke audit trail.
 * Semua tulisan berada dalam satu transaksi Dexie, jadi audit tidak bisa
 * tertinggal bila update gagal.
 */
export async function updateTransaction(txId: number, changes: TransactionChanges, at?: string): Promise<void> {
  const timestamp = nowISO(at);
  await db.transaction('rw', [db.transactions, db.transactionAudit], async () => {
    const before = await db.transactions.get(txId);
    if (!before || before.deletedAt) throw new Error('transaction-not-found');
    await db.transactionAudit.add({ txId, action: 'update', at: timestamp, before });
    await db.transactions.update(txId, { ...changes, updatedAt: timestamp });
  });
}

/** Soft delete: baris tetap tersimpan dan bisa dipulihkan lewat undo. */
export async function softDeleteTransaction(txId: number, at?: string): Promise<Transaction> {
  const timestamp = nowISO(at);
  let before: Transaction | undefined;
  await db.transaction('rw', [db.transactions, db.transactionAudit], async () => {
    before = await db.transactions.get(txId);
    if (!before || before.deletedAt) throw new Error('transaction-not-found');
    await db.transactionAudit.add({ txId, action: 'delete', at: timestamp, before });
    await db.transactions.update(txId, { deletedAt: timestamp, updatedAt: timestamp });
  });
  if (!before) throw new Error('transaction-not-found');
  return before;
}

export async function restoreTransaction(txId: number, at?: string): Promise<void> {
  const timestamp = nowISO(at);
  await db.transaction('rw', [db.transactions, db.transactionAudit], async () => {
    const before = await db.transactions.get(txId);
    if (!before?.deletedAt) throw new Error('transaction-not-found');
    await db.transactionAudit.add({ txId, action: 'restore', at: timestamp, before, after: { ...before, deletedAt: undefined } });
    await db.transactions.update(txId, { deletedAt: undefined, updatedAt: timestamp });
  });
}

/** Hapus permanen hanya untuk tombol "hapus semua data"; bukan aksi baris. */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.transactions, db.chatMessages, db.transactionAudit], async () => {
    await db.transactions.clear();
    await db.chatMessages.clear();
    await db.transactionAudit.clear();
  });
}
