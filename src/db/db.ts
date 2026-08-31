import Dexie, { type EntityTable } from 'dexie';

export interface Transaction {
  id?: number;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  createdAt: string;
  rawText?: string;
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
};

db.version(2).stores({
  transactions: '++id, date, createdAt',
  chatMessages: '++id, role, createdAt',
});

export { db };
