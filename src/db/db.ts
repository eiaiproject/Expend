import Dexie, { type EntityTable } from 'dexie';

export interface Transaction {
  id?: number;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  rawText?: string;
  note?: string;
  source?: string;
}

export interface TransactionAudit {
  id?: number;
  txId: number;
  action: 'create' | 'update' | 'delete' | 'restore';
  at: string;
  before?: Transaction;
  after?: Transaction;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  txId?: number | null;
  parsed?: { description: string; amount: number } | null;
}

const db = new Dexie('ExpendDB') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  chatMessages: EntityTable<ChatMessage, 'id'>;
  transactionAudit: EntityTable<TransactionAudit, 'id'>;
};

db.version(2).stores({
  transactions: '++id, date, createdAt',
  chatMessages: '++id, role, createdAt',
});

// v3 additive: index baru untuk query balik tanpa mengubah bentuk baris.
// amount/source memungkinkan filter nominal/sumber tanpa full-scan;
// txId memungkinkan "pesan untuk transaksi X". Upgrade no-op (index otomatis).
db.version(3).stores({
  transactions: '++id, date, createdAt, amount, source',
  chatMessages: '++id, role, createdAt, txId',
});

// v4 additive: soft delete + audit trail. Baris lama tetap valid; deletedAt
// hanya diisi saat pengguna menghapus, sehingga data bisa dipulihkan.
db.version(4).stores({
  transactions: '++id, date, createdAt, amount, source, deletedAt',
  chatMessages: '++id, role, createdAt, txId',
  transactionAudit: '++id, txId, at',
});

export { db };
