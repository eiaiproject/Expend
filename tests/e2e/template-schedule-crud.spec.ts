import { test, expect, type Page } from '@playwright/test';
import {
  uniqueName,
  visitApp,
  completeOnboarding,
  openActionPicker,
  clickPickerAction,
} from './helpers';

/** Close the Quick Add sheet; accepts the discard-changes confirm if the form is dirty. */
async function closeQuickAdd(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^close$/i }).click();
  const discard = page.locator('dialog:has-text("Discard changes")');
  if (await discard.isVisible().catch(() => false)) {
    await discard.getByRole('button', { name: /^discard$/i }).click();
  }
}

// ─── master.md 5.4: template CRUD (create → apply → long-press delete) ──
test.describe('template CRUD', () => {
  test('save from Quick Add → chip applies prefill → long-press deletes', async ({ page }) => {
    const walletName = uniqueName('Cash');
    const tplName = uniqueName('Kopi');
    await visitApp(page);
    await completeOnboarding(page, {
      walletName,
      walletBalance: '300000',
      categories: ['Food & Drinks'],
    });

    // CREATE — save the current Quick Add form as a template.
    await openActionPicker(page);
    await clickPickerAction(page, /add expense/i);
    await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 10_000 });
    await page.getByRole('button', { name: /add details/i }).first().click();
    await page
      .locator('form input[type="text"]:not([inputmode]):not([role="combobox"])')
      .first()
      .fill(tplName);
    await page.locator('form input[inputmode="numeric"]').first().fill('15000');
    await page.getByRole('button', { name: /save as template/i }).click();
    await expect(page.getByRole('status').filter({ visible: true }).getByText('Template saved')).toBeVisible({ timeout: 5_000 });
    await closeQuickAdd(page);

    // READ — chip appears in the Templates row of a fresh Quick Add.
    await openActionPicker(page);
    await clickPickerAction(page, /add expense/i);
    await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 10_000 });
    const templatesList = page.getByRole('list', { name: /templates/i });
    await expect(templatesList).toBeVisible();
    const chip = templatesList.getByRole('button', { name: new RegExp(tplName, 'i') });
    await expect(chip).toBeVisible();

    // APPLY — tapping the chip prefills description.
    await chip.click();
    await page.getByRole('button', { name: /add details/i }).first().click();
    await page.waitForFunction(
      (name) => {
        const input = document.querySelector(
          'form input[type="text"]:not([inputmode]):not([role="combobox"])'
        ) as HTMLInputElement | null;
        return input && input.value === name;
      },
      tplName,
      { timeout: 5_000 },
    );
    await closeQuickAdd(page);

    // DELETE — long-press (600ms) opens the danger confirm; chip disappears.
    await openActionPicker(page);
    await clickPickerAction(page, /add expense/i);
    await page.waitForSelector('form input[inputmode="numeric"]', { timeout: 10_000 });
    const chip2 = page
      .getByRole('list', { name: /templates/i })
      .getByRole('button', { name: new RegExp(tplName, 'i') });
    await expect(chip2).toBeVisible();
    // Let the sheet's slide-up animation finish so the chip is stationary.
    await page.waitForTimeout(450);

    const box = await chip2.boundingBox();
    if (!box) throw new Error('template chip has no bounding box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();

    const confirmDialog = page.locator('dialog').filter({ hasText: /delete template/i });
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    await confirmDialog.getByRole('button', { name: /^delete$/i }).click();
    await expect(page.getByRole('status').filter({ visible: true }).getByText('Template deleted')).toBeVisible({ timeout: 5_000 });
    // Templates row unmounts when the last template is deleted.
    await expect(page.getByRole('list', { name: /templates/i })).toHaveCount(0);
  });
});

// ─── master.md 7.x: schedule CRUD via the Schedules page ───────────────
test.describe('schedule CRUD', () => {
  async function openSchedules(page: Page): Promise<void> {
    await page.goto('/schedules');
    await page.waitForURL(/\/schedules$/, { timeout: 10_000 });
  }

  test('create → edit → delete a recurring schedule', async ({ page }) => {
    const walletName = uniqueName('Cash');
    const payee = uniqueName('Rent');
    await visitApp(page);
    await completeOnboarding(page, {
      walletName,
      walletBalance: '300000',
      categories: ['Food & Drinks'],
    });
    await openSchedules(page);

    // CREATE — Add schedule → fill payee + amount → save.
    await page.getByRole('button', { name: /add schedule/i }).first().click();
    const form = page.getByRole('dialog');
    await form.getByLabel(/payee \/ description/i).fill(payee);
    await form.getByLabel(/amount/i).fill('50000');
    await form.getByRole('button', { name: /add schedule/i }).click();
    await expect(page.getByRole('status').filter({ visible: true }).getByText('Schedule created')).toBeVisible({ timeout: 5_000 });

    // READ — card renders with the payee and amount.
    const card = page.getByText(payee, { exact: true }).first();
    await expect(card).toBeVisible({ timeout: 5_000 });
    await expect(card.locator('xpath=ancestor::li')).toContainText('50.000');

    // UPDATE — Edit → change amount → Save Changes.
    await card.locator('xpath=ancestor::li').getByRole('button', { name: /^edit$/i }).click();
    const editForm = page.getByRole('dialog');
    await editForm.getByLabel(/amount/i).fill('75000');
    await editForm.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByRole('status').filter({ visible: true }).getByText('Schedule updated')).toBeVisible({ timeout: 5_000 });
    await expect(card.locator('xpath=ancestor::li')).toContainText('75.000');

    // DELETE — danger confirm → card gone.
    await card.locator('xpath=ancestor::li').getByRole('button', { name: /^delete$/i }).click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: /^delete$/i }).click();
    await expect(page.getByRole('status').filter({ visible: true }).getByText('Schedule deleted')).toBeVisible({ timeout: 5_000 });
    await expect(card).toHaveCount(0);
  });
});
