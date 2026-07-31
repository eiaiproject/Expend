import { test, expect, type Page } from '@playwright/test';
import { visitApp, completeOnboarding, readTransactions } from './helpers';

// master.md 11: staged CSV import — preview, duplicate detection, skip/anyway
// choice, atomic import, and a result report.
const CSV_HEADER = 'date,wallet,category,recipient,amount,type,notes\n';

function csvFile(rows: string[], name: string) {
  return {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV_HEADER + rows.join('\n'), 'utf-8'),
  };
}

async function importCsv(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, { skip }: { skip: boolean }) {
  await page.goto('/settings');
  const accordion = page.getByRole('button', { name: /transaction import & export/i });
  await accordion.click();
  await expect(accordion).toHaveAttribute('aria-expanded', 'true');
  await page.getByText(/import transactions from csv/i).click();
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles(file);

  // Preview modal lists the rows; duplicates get a behavior choice.
  const dialog = page.getByRole('dialog', { name: /csv preview/i });
  await dialog.waitFor({ state: 'visible' });
  const radios = dialog.getByRole('radio');
  if ((await radios.count()) > 0) {
    await radios.nth(skip ? 0 : 1).check(); // skip duplicates | import anyway
  }
  await dialog.getByRole('button', { name: /import/i }).click();
  return page;
}

test.describe('csv import wizard (master.md 11)', () => {
  test('imports rows, detects re-import duplicates, skips or imports anyway, and reports', async ({ page }) => {
    await visitApp(page);
    await completeOnboarding(page, {
      walletName: 'Cash',
      walletBalance: '500000',
      categories: ['Food & Drinks'],
    });

    // Use recent dates so the CSV import never trips the support prompt's
    // 30-day meaningful-use milestone (which would overlay the settings UI).
    const isoToday = new Date().toISOString().slice(0, 10);
    const isoYesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const rows = [
      `${isoYesterday},Cash,Food & Drinks,Kopi Senja,15000,expense,`,
      `${isoToday},Cash,Food & Drinks,Teh Botol,8000,expense,`,
    ];
    const file = csvFile(rows, 'transactions.csv');

    // First import: both rows are new, no duplicate choice shown.
    await importCsv(page, file, { skip: true });
    const reportDialog = page.getByRole('dialog', { name: /import report/i });
    await expect(reportDialog).toBeVisible();
    await expect(reportDialog.getByText(/imported: 2/i)).toBeVisible();
    const reloaded = page.waitForEvent('framenavigated');
    await reportDialog.getByRole('button', { name: /done/i }).click();
    await expect(page.getByRole('status').getByText(/2 transaction/i)).toBeVisible();
    await reloaded; // reload happens after the toast
    expect(await readTransactions(page)).toHaveLength(2);

    // Re-import the same file: duplicates are detected and skipped by default.
    await importCsv(page, file, { skip: true });
    const report2 = page.getByRole('dialog', { name: /import report/i });
    await expect(report2.getByText(/imported: 0/i)).toBeVisible();
    await expect(report2.getByText(/skipped: 2/i)).toBeVisible();
    await report2.getByRole('button', { name: /done/i }).click();
    expect(await readTransactions(page)).toHaveLength(2); // unchanged

    // Third import chooses "import anyway": duplicates are inserted.
    await importCsv(page, file, { skip: false });
    const report3 = page.getByRole('dialog', { name: /import report/i });
    await expect(report3.getByText(/imported: 2/i)).toBeVisible();
    const reloaded3 = page.waitForEvent('framenavigated');
    await report3.getByRole('button', { name: /done/i }).click();
    await reloaded3;
    expect(await readTransactions(page)).toHaveLength(4);
  });
});
