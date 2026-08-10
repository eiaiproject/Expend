/**
 * Dev-only sample seeder (visit `/?seed=sample` in `npm run dev`).
 *
 * Adds exactly 50 expense transactions across 10 realistic payees so the
 * Quick Payees chips, Home list, and Stats have example data to work with.
 * Additive by design — it appends to any existing data. Idempotent: a
 * settings marker prevents duplicate runs, so revisiting the URL or a
 * refresh does not add another 50 rows.
 */
import { db, type Category, type Wallet } from '../db/db';
import { CURATED_PALETTE, STORAGE_KEYS } from './constants';
import { recomputeWalletCurrentBalances } from './balanceUtils';

const SAMPLE_MARKER_KEY = 'sampleSeeded50';

interface SamplePayee {
  readonly name: string;
  readonly category: string;
  readonly count: number;
  readonly amountRange: readonly [number, number];
}

// 10 payees, 50 transactions total (7+7+6+5+5+5+4+4+4+3).
const SAMPLE_PAYEES: readonly SamplePayee[] = [
  { name: 'Warung Bu Tini', category: 'Makanan & Minuman', count: 7, amountRange: [12_000, 45_000] },
  { name: 'Kopi Kenangan', category: 'Makanan & Minuman', count: 7, amountRange: [18_000, 35_000] },
  { name: 'GoFood', category: 'Makanan & Minuman', count: 6, amountRange: [25_000, 90_000] },
  { name: 'Indomaret', category: 'Belanja', count: 5, amountRange: [15_000, 120_000] },
  { name: 'Alfamart', category: 'Belanja', count: 5, amountRange: [10_000, 85_000] },
  { name: 'Gojek', category: 'Transportasi', count: 5, amountRange: [8_000, 45_000] },
  { name: 'Grab', category: 'Transportasi', count: 4, amountRange: [10_000, 50_000] },
  { name: 'PLN', category: 'Tagihan & Langganan', count: 4, amountRange: [150_000, 400_000] },
  { name: 'Netflix', category: 'Hiburan', count: 4, amountRange: [49_000, 79_000] },
  { name: 'Apotek K-24', category: 'Kesehatan', count: 3, amountRange: [30_000, 150_000] },
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Find a category by name, creating it (with a fresh palette color) if missing. */
async function ensureCategory(name: string, existing: readonly Category[]): Promise<number> {
  const match = existing.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (match?.id != null) return match.id;
  const usedColors = new Set(existing.map((c) => c.color));
  const color = CURATED_PALETTE.find((c) => !usedColors.has(c)) ?? CURATED_PALETTE[0]!;
  const newId = await db.categories.add({ name, icon: 'Tag', color });
  return newId ?? 0;
}

export async function seedSampleData(): Promise<number> {
  // Idempotent: only ever seed the 50 sample rows once per browser.
  const marker = await db.settings.get(SAMPLE_MARKER_KEY);
  if (marker?.value === 'true') return 0;

  // Reuse an existing active wallet (or create a default one).
  let wallets = await db.wallets.toArray();
  let active = wallets.filter((w) => !w.archivedAt);
  if (active.length === 0) {
    await db.wallets.add({
      name: 'Cash',
      currency: 'IDR',
      initialBalance: 1_000_000,
      currentBalance: 1_000_000,
      lastUpdated: new Date().toISOString(),
    });
    wallets = await db.wallets.toArray();
    active = wallets.filter((w) => !w.archivedAt);
  }
  const walletId = active[0]?.id ?? 0;

  const existingCategories = await db.categories.toArray();
  const categoryIdCache = new Map<string, number>();
  const categoryIdFor = async (name: string): Promise<number> => {
    const cached = categoryIdCache.get(name);
    if (cached != null) return cached;
    const id = await ensureCategory(name, existingCategories);
    categoryIdCache.set(name, id);
    return id;
  };

  // Spread across the last 30 days so Today/This Week groups stay lively.
  type SeedRow = Parameters<typeof db.transactions.bulkAdd>[0][number];
  const today = new Date();
  const rows: SeedRow[] = [];
  let i = 0;
  for (const payee of SAMPLE_PAYEES) {
    const categoryId = await categoryIdFor(payee.category);
    for (let k = 0; k < payee.count; k++, i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (i % 30));
      const [min, max] = payee.amountRange;
      const amount = min + ((i * 37 + k * 13) % (max - min + 1));
      rows.push({
        walletId,
        categoryId,
        date: iso(date),
        description: payee.name,
        type: 'expense',
        amount,
      });
    }
  }

  await db.transactions.bulkAdd(rows);

  // Recompute balances exactly like import/restore does.
  const allWallets = await db.wallets.toArray();
  const allTransactions = await db.transactions.toArray();
  const debts = await db.debts.toArray();
  const debtPayments = await db.debtPayments.toArray();
  const recomputed = recomputeWalletCurrentBalances(allWallets, allTransactions, debts, debtPayments);
  await db.wallets.bulkPut(recomputed.map((w) => ({ ...w, lastUpdated: new Date().toISOString() })) as unknown as Wallet[]);

  await db.settings.put({ key: SAMPLE_MARKER_KEY, value: 'true' });

  // Skip onboarding on next load — data is already there.
  localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');

  return rows.length;
}
