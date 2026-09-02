import { test, expect } from '@playwright/test';

type Case = { input: string; desc: string; amount: number; source?: string };

const CASES: Case[] = [
  { input: 'kopi 50rb', desc: 'Kopi', amount: 50000 },
  { input: 'nasi goreng 35rb', desc: 'Nasi Goreng', amount: 35000 },
  { input: 'ayam geprek 25rb', desc: 'Ayam Geprek', amount: 25000 },
  { input: 'sate ayam 40rb', desc: 'Sate Ayam', amount: 40000 },
  { input: 'bakso 30rb', desc: 'Bakso', amount: 30000 },
  { input: 'parkir 5 ribu', desc: 'Parkir', amount: 5000 },
  { input: 'sewa kos 2 juta', desc: 'Sewa Kos', amount: 2000000 },
  { input: 'laptop 1,5jt', desc: 'Laptop', amount: 1500000 },
  { input: 'motor bekas 15jt', desc: 'Motor Bekas', amount: 15000000 },
  { input: 'token 500k', desc: 'Token', amount: 500000 },
  { input: 'belanja indomaret 50000', desc: 'Indomaret', amount: 50000 },
  { input: 'belanja alfamart 75000', desc: 'Alfamart', amount: 75000 },
  { input: 'belanja 50.000', desc: 'Belanja', amount: 50000 },
  { input: 'bayar 125.000', desc: 'Bayar', amount: 125000 },
  { input: 'beli kopi Rp 25.000', desc: 'Kopi', amount: 25000 },
  { input: 'makan siang Rp 75.000', desc: 'Makan Siang', amount: 75000 },
  { input: 'kopi 20000 dari kas', desc: 'Kopi', amount: 20000, source: 'kas' },
  { input: 'KPR 7500000 dari BSI', desc: 'KPR', amount: 7500000, source: 'BSI' },
  { input: 'makan siang 50rb via GoPay', desc: 'Makan Siang', amount: 50000, source: 'GoPay' },
  { input: 'bayar listrik 200rb pakai Dana', desc: 'Listrik', amount: 200000, source: 'Dana' },
  { input: 'transfer BCA 100rb', desc: 'BCA', amount: 100000 },
  { input: 'beli kopi di Indomaret 50000', desc: 'Kopi Indomaret', amount: 50000 },
  { input: 'makan di warteg 25rb', desc: 'Makan Warteg', amount: 25000 },
  { input: 'kopi di starbucks 45rb', desc: 'Kopi Starbucks', amount: 45000 },
  { input: 'bayar parkir 5000 di lantai 2', desc: 'Parkir', amount: 5000 },
  { input: 'makan 25000 di lantai 3', desc: 'Makan', amount: 25000 },
  { input: 'beli 2 dus kopi 50rb', desc: '2 Dus Kopi', amount: 50000 },
  { input: 'bayar 150000 tagihan 50000', desc: 'Tagihan', amount: 150000 },
  { input: 'beli kopi susu 25rb', desc: 'Kopi Susu', amount: 25000 },
  { input: 'transfer adik 100rb', desc: 'Adik', amount: 100000 },
  { input: 'top up OVO 100rb', desc: 'OVO', amount: 100000 },
  { input: 'isi OVO 50rb via BCA', desc: 'OVO', amount: 50000, source: 'BCA' },
  { input: 'beli bensin 50rb dari BCA', desc: 'Bensin', amount: 50000, source: 'BCA' },
  { input: 'bayar langganan netflix 65rb', desc: 'Langganan Netflix', amount: 65000 },
  { input: 'jajan di kantin 12rb', desc: 'Kantin', amount: 12000 },
  { input: 'order grabfood 48rb', desc: 'Grabfood', amount: 48000 },
  { input: 'pesan gojek 35rb', desc: 'Gojek', amount: 35000 },
  { input: 'bengkel motor 250rb', desc: 'Bengkel Motor', amount: 250000 },
  { input: 'potong rambut 30rb', desc: 'Potong Rambut', amount: 30000 },
  { input: 'beli pulsa 20rb', desc: 'Pulsa', amount: 20000 },
  { input: 'token listrik 100rb', desc: 'Token Listrik', amount: 100000 },
  { input: 'air galon 22rb', desc: 'Air Galon', amount: 22000 },
  { input: 'laundry 45rb', desc: 'Laundry', amount: 45000 },
  { input: 'bensin 75k', desc: 'Bensin', amount: 75000 },
  { input: 'kopi 15,5rb', desc: 'Kopi', amount: 15500 },
  { input: 'bayar kos 1,5 juta', desc: 'Kos', amount: 1500000 },
  { input: 'investasi saham 500rb dari BNI', desc: 'Investasi Saham', amount: 500000, source: 'BNI' },
  { input: 'kopi tubruk 18rb pakai OVO', desc: 'Kopi Tubruk', amount: 18000, source: 'OVO' },
  { input: 'donasi masjid 100rb via BSI', desc: 'Donasi Masjid', amount: 100000, source: 'BSI' },
  { input: 'gaji flex 3jt', desc: 'Gaji Flex', amount: 3000000 },
];

test.setTimeout(180_000);

test('chat 50 variasi transaksi', async ({ page }) => {
  // fresh DB
  await page.goto('/');
  await page.evaluate(() => new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase('ExpendDB'); r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res();
  }));
  await page.goto('/chat');
  await page.reload();
  await page.goto('/chat');
  await expect(page.getByPlaceholder(/Contoh/)).toBeVisible({ timeout: 15000 });

  let idx = 0;
  for (const c of CASES) {
    const input = page.getByPlaceholder(/Contoh/);
    await input.fill(c.input);
    await page.getByRole('button', { name: 'Kirim transaksi' }).click();

    // pending form appears
    const descInput = page.locator('#pending-desc');
    await expect(descInput).toBeVisible({ timeout: 8000 });
    await expect(descInput).toHaveValue(c.desc, { timeout: 5000 });
    await expect(page.locator('#pending-amount')).toHaveValue(String(c.amount));
    if (c.source) {
      await expect(page.locator('#pending-source')).toHaveValue(c.source);
    }
    // verify assistant preview
    await expect(page.getByText('Siap dicatat').last()).toBeVisible();

    await page.getByRole('button', { name: 'Simpan transaksi' }).click();

    // saved: pending disappears, Tercatat appears
    await expect(page.getByText(/Tercatat/).last()).toBeVisible({ timeout: 8000 });
    await expect(descInput).toHaveCount(0, { timeout: 5000 });

    idx++;
    // progress log for human
    if (idx % 10 === 0) console.log(`  ✓ ${idx}/50 ${c.input} → ${c.desc} ${c.amount}`);
  }

  expect(idx).toBe(50);

  // verify via DB count and total
  await page.goto('/');
  await expect(page.getByText('Total pengeluaran')).toBeVisible({ timeout: 10000 });

  const total = CASES.reduce((a, c) => a + c.amount, 0);
  const totalDigits = String(total);

  // total displayed contains Rp formatted sum — check digits only
  await expect.poll(async () => (await page.locator('.tabular-nums').first().textContent())?.replace(/\D/g, ''), { timeout: 15000 }).toBe(totalDigits);

  await expect(page.getByText(`${CASES.length} transaksi`)).toBeVisible();

  // check count via delete buttons (50 rows)
  await expect(page.locator('button[aria-label^="Hapus transaksi"]')).toHaveCount(50, { timeout: 10000 });

  // spot-check a few descriptions exist in Home list
  for (const spot of ['Nasi Goreng', 'Motor Bekas', 'Kopi Indomaret', 'Bensin', 'Gaji Flex']) {
    await expect(page.getByText(spot).first()).toBeVisible();
  }

  console.log(`DONE 50 variasi total=${totalDigits} fmt=${new Intl.NumberFormat('id-ID').format(total)}`);
});
