import { expect, test, type Page } from '@playwright/test';

async function seedLegacyDebtSchema(page: Page) {
  await page.goto('/offline.html');

  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('ExpendDB');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ExpendDB', 80);

      request.onupgradeneeded = () => {
        const db = request.result;
        const wallets = db.createObjectStore('wallets', { keyPath: 'id', autoIncrement: true });
        for (const name of ['name', 'currency', 'lastUpdated', 'currentBalance']) wallets.createIndex(name, name);

        const categories = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
        for (const name of ['name', 'icon', 'color', 'budget']) categories.createIndex(name, name);

        const transactions = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        for (const name of ['walletId', 'categoryId', 'date', 'description', 'type', 'amount', 'transferGroupId']) {
          transactions.createIndex(name, name);
        }
        transactions.createIndex('[type+date]', ['type', 'date']);
        transactions.createIndex('[walletId+date]', ['walletId', 'date']);
        transactions.createIndex('[categoryId+date]', ['categoryId', 'date']);

        db.createObjectStore('settings', { keyPath: 'key' });

        const debts = db.createObjectStore('debts', { keyPath: 'id', autoIncrement: true });
        for (const name of ['type', 'contactName', 'status', 'dueDate', 'walletId']) debts.createIndex(name, name);
        debts.createIndex('[status+dueDate]', ['status', 'dueDate']);

        const debtPayments = db.createObjectStore('debt_payments', { keyPath: 'id', autoIncrement: true });
        for (const name of ['debtId', 'date', 'transactionId']) debtPayments.createIndex(name, name);
        debtPayments.createIndex('[debtId+date]', ['debtId', 'date']);
      };

      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['wallets', 'categories', 'debts', 'debt_payments'], 'readwrite');

        tx.objectStore('wallets').add({
          id: 1,
          name: 'Legacy Wallet',
          currency: 'IDR',
          initialBalance: 1_000_000,
          currentBalance: 1_000_000,
          lastUpdated: new Date().toISOString(),
        });
        tx.objectStore('categories').add({ id: 1, name: 'Food & Drinks', icon: 'utensils', color: '#14b8a6' });
        tx.objectStore('debts').add({
          id: 1,
          type: 'payable',
          contactName: 'Budi',
          description: 'Pinjaman lama',
          amount: 250_000,
          remainingAmount: 150_000,
          dueDate: '2026-06-20',
          createdAt: '2026-06-01T00:00:00.000Z',
          status: 'partial',
          walletId: 1,
          notes: 'Legacy note',
          categoryId: 1,
        });
        tx.objectStore('debt_payments').add({
          id: 1,
          debtId: 1,
          amount: 100_000,
          date: '2026-06-05',
          note: 'Bayar sebagian',
        });

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      request.onerror = () => reject(request.error);
    });
  });
}

test('legacy debt schema opens from Wallets debt link', async ({ page }) => {
  await seedLegacyDebtSchema(page);
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en');
    localStorage.setItem('expend_bypass_pwa', 'true');
    localStorage.setItem('expend_has_onboarded', 'true');
    localStorage.setItem('expend_onboarding_completed', 'true');
  });

  await page.goto('/wallets');
  await page.getByRole('link', { name: /Utang Piutang.*Lihat/s }).click();

  // Heading is translated; English = 'Debts & Receivables', Indonesian = 'Utang Piutang'
  await expect(page.getByRole('heading', { name: /Utang Piutang|Debts & Receivables/ })).toBeVisible();
  await expect(page.getByText('Budi')).toBeVisible();
  await expect(page.getByText(/Something went wrong|Terjadi Kesalahan/i)).toHaveCount(0);

  const migrated = await page.evaluate(async () => (
    new Promise<{ version: number; stores: string[]; debtCount: number; paymentCount: number }>((resolve, reject) => {
      const request = indexedDB.open('ExpendDB');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['debts', 'debtPayments'], 'readonly');
        const debts = tx.objectStore('debts').getAll();
        const payments = tx.objectStore('debtPayments').getAll();
        tx.oncomplete = () => {
          resolve({
            version: db.version,
            stores: [...db.objectStoreNames],
            debtCount: debts.result.length,
            paymentCount: payments.result.length,
          });
          db.close();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      request.onerror = () => reject(request.error);
    })
  ));

  expect(migrated.version).toBe(100);
  expect(migrated.stores).toContain('debtPayments');
  expect(migrated.stores).not.toContain('debt_payments');
  expect(migrated.debtCount).toBe(1);
  expect(migrated.paymentCount).toBe(2);
});
