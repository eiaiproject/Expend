/**
 * Dev-only demo seeder (master.md §12 demo data).
 *
 * Activated by visiting `/?seed=demo` in `npm run dev`.
 * Writes ~7 months of realistic Indonesian expense history (Jan 1 → today)
 * into the CURRENT browser's IndexedDB, then recomputes wallet balances.
 * Idempotent: refuses to run when transactions already exist.
 *
 * Deterministic (fixed RNG seed) so reruns produce identical data.
 */
import { db, type Wallet, type Category } from '../db/db';
import { STORAGE_KEYS } from './constants';
import { recomputeWalletCurrentBalances } from './balanceUtils';

// ── Deterministic RNG ──────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260101);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const ri = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

// ── Data ───────────────────────────────────────────────────────────

const CATEGORY_DEFS = [
  { name: 'Makanan & Minuman', color: '#EF4444' },
  { name: 'Transportasi', color: '#F97316' },
  { name: 'Belanja', color: '#EAB308' },
  { name: 'Tagihan & Langganan', color: '#06B6D4' },
  { name: 'Kesehatan', color: '#22C55E' },
  { name: 'Hiburan', color: '#A855F7' },
  { name: 'Pendidikan', color: '#3B82F6' },
  { name: 'Lainnya', color: '#64748B' },
] as const;

const FOOD_PAYEES = ['Warung Bu Tini', 'Kopi Kenangan', 'GoFood', 'Alfamart', 'Indomaret', 'Bakso Mas Joko', 'Ayam Geprek'] as const;
const TRANSPORT_PAYEES = ['Gojek', 'Grab', 'TransJakarta', 'Pertamini'] as const;
const SHOP_PAYEES = ['Tokopedia', 'Shopee', 'Uniqlo', 'Supermarket'] as const;
const HEALTH_PAYEES = ['Apotek K-24', 'Klinik Sehat'] as const;
const FUN_PAYEES = ['Cinema XXI', 'Steam', 'Toko Buku'] as const;

type SeedRow = Parameters<typeof db.transactions.bulkAdd>[0][number];

interface SeedContext {
  readonly bcaId: number;
  readonly gopayId: number;
  readonly cashId: number;
  readonly cat: (name: string) => number;
  readonly iso: (d: Date) => string;
  readonly topupNo: { value: number };
}

function pickMealWallet(cashId: number, gopayId: number, bcaId: number): number {
  // Mirrors the original nested ternary exactly (re-rolls on the inner
  // condition) so the deterministic RNG sequence is unchanged.
  if (rand() < 0.08) return cashId;
  if (rand() < 0.72) return gopayId;
  return bcaId;
}

/** Rows generated for one calendar day (salary, bills, top-ups, spending). */
function buildDayRows(d: Date, ctx: SeedContext): SeedRow[] {
  const date = ctx.iso(d);
  const day = d.getDay();
  const isWeekend = day % 6 === 0; // Sat (6) & Sun (0): both ≡ 0 (mod 6)
  const dayOfMonth = d.getDate();
  const rows: SeedRow[] = [];

  // Salary on the 25th into BCA
  if (dayOfMonth === 25) {
    rows.push({ walletId: ctx.bcaId, categoryId: ctx.cat('Lainnya'), date, description: 'Gaji bulanan', type: 'balance_adjustment', amount: 8_500_000 });
    if (d.getMonth() % 2 === 0) {
      rows.push({ walletId: ctx.bcaId, categoryId: ctx.cat('Lainnya'), date, description: 'Proyek freelance', type: 'balance_adjustment', amount: ri(1_000_000, 2_500_000) });
    }
  }

  // Fixed bills on the 1st (skip the very first day's double — fine, rent counts)
  if (dayOfMonth === 1) {
    rows.push(
      { walletId: ctx.bcaId, categoryId: ctx.cat('Tagihan & Langganan'), date, description: 'Sewa Kos', type: 'expense', amount: 2_500_000 },
      { walletId: ctx.bcaId, categoryId: ctx.cat('Tagihan & Langganan'), date, description: 'Listrik PLN', type: 'expense', amount: ri(300_000, 480_000) },
      { walletId: ctx.bcaId, categoryId: ctx.cat('Tagihan & Langganan'), date, description: 'WiFi IndiHome', type: 'expense', amount: 350_000 },
      { walletId: ctx.bcaId, categoryId: ctx.cat('Tagihan & Langganan'), date, description: 'Pulsa Telkomsel', type: 'expense', amount: 100_000 },
      { walletId: ctx.gopayId, categoryId: ctx.cat('Hiburan'), date, description: 'Netflix', type: 'expense', amount: 79_000 },
      { walletId: ctx.gopayId, categoryId: ctx.cat('Hiburan'), date, description: 'Spotify', type: 'expense', amount: 54_000 },
    );
  }

  // GoPay top-up from BCA ~3×/month (keeps e-wallet net-positive)
  if ([5, 15, 25].includes(dayOfMonth)) {
    const amount = ri(700_000, 1_400_000);
    const groupId = `seed-topup-${++ctx.topupNo.value}`;
    rows.push(
      { walletId: ctx.bcaId, categoryId: null, date, description: 'Top-up GoPay', type: 'transfer_out', amount, transferGroupId: groupId },
      { walletId: ctx.gopayId, categoryId: null, date, description: 'Top-up GoPay', type: 'transfer_in', amount, transferGroupId: groupId },
    );
  }

  // Daily food: 1–3 meals
  const meals = ri(1, 3);
  for (let m = 0; m < meals; m++) {
    rows.push({
      walletId: pickMealWallet(ctx.cashId, ctx.gopayId, ctx.bcaId),
      categoryId: ctx.cat('Makanan & Minuman'),
      date,
      description: pick(FOOD_PAYEES),
      type: 'expense',
      amount: ri(8_000, 65_000),
    });
  }

  // Transport most weekdays (Sat=6, Sun=0 → only days 1–5 qualify)
  if (day % 6 !== 0 && rand() < 0.6) {
    rows.push({ walletId: ctx.gopayId, categoryId: ctx.cat('Transportasi'), date, description: pick(TRANSPORT_PAYEES), type: 'expense', amount: ri(3_500, 45_000) });
  }

  // Weekend leisure/shopping
  if (isWeekend && rand() < 0.45) {
    if (rand() < 0.5) {
      rows.push({ walletId: ctx.gopayId, categoryId: ctx.cat('Belanja'), date, description: pick(SHOP_PAYEES), type: 'expense', amount: ri(50_000, 500_000) });
    } else {
      rows.push({ walletId: ctx.gopayId, categoryId: ctx.cat('Hiburan'), date, description: pick(FUN_PAYEES), type: 'expense', amount: ri(25_000, 150_000) });
    }
  }

  // Occasional health
  if (rand() < 0.03) {
    rows.push({ walletId: ctx.bcaId, categoryId: ctx.cat('Kesehatan'), date, description: pick(HEALTH_PAYEES), type: 'expense', amount: ri(30_000, 250_000) });
  }

  return rows;
}

// ── Seed ───────────────────────────────────────────────────────────

export async function seedDemoData(): Promise<number> {
  // Idempotent: never seed over real data.
  const existing = await db.transactions.count();
  if (existing > 0) return 0;

  // Wallets — explicit ids so rows below are statically typed (seed-only DB)
  const [cashId, gopayId, bcaId] = [1, 2, 3] as const;
  await db.wallets.bulkPut([
    { id: cashId, name: 'Dompet Utama', currency: 'IDR', initialBalance: 5_000_000, currentBalance: 5_000_000, lastUpdated: new Date().toISOString() },
    { id: gopayId, name: 'GoPay', currency: 'IDR', initialBalance: 500_000, currentBalance: 500_000, lastUpdated: new Date().toISOString() },
    { id: bcaId, name: 'Bank BCA', currency: 'IDR', initialBalance: 3_000_000, currentBalance: 3_000_000, lastUpdated: new Date().toISOString() },
  ]);

  // Categories — explicit ids (101..108) for static typing
  const categoryIds = new Map<string, number>();
  CATEGORY_DEFS.forEach((def, i) => categoryIds.set(def.name, 101 + i));
  await db.categories.bulkPut(CATEGORY_DEFS.map((def, i) => ({
    id: 101 + i,
    name: def.name,
    icon: 'Tag',
    color: def.color,
  }) satisfies Category));

  // Today, clamped to a sane max for reproducibility
  const today = new Date();
  const START = new Date(2026, 0, 1); // 2026-01-01 local

  const cat = (name: string) => categoryIds.get(name)!;
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const ctx: SeedContext = { bcaId, gopayId, cashId, cat, iso, topupNo: { value: 0 } };

  const rows: SeedRow[] = [];
  for (let d = new Date(START); d <= today; d.setDate(d.getDate() + 1)) {
    rows.push(...buildDayRows(d, ctx));
  }

  await db.transactions.bulkAdd(rows);

  // Recompute balances exactly like import/restore does
  const wallets = await db.wallets.toArray();
  const transactions = await db.transactions.toArray();
  const debts = await db.debts.toArray();
  const debtPayments = await db.debtPayments.toArray();
  const recomputed = recomputeWalletCurrentBalances(wallets, transactions, debts, debtPayments);
  await db.wallets.bulkPut(recomputed.map(w => ({ ...w, lastUpdated: new Date().toISOString() })) as unknown as Wallet[]);

  // Skip onboarding on next load — data is already there
  localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');

  return rows.length;
}
