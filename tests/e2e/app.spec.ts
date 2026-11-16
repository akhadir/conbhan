import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('full credit lifecycle: goal, credits, clear, persistence, export and import', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /conbhan/i }).first()).toBeVisible();
  await expect(page.getByText('General Credits').first()).toBeVisible();
  await expect(page.getByText(/0 Credits/).first()).toBeVisible();

  // Create a fixed goal with a runtime category and two runtime labels.
  await page.getByRole('button', { name: /new goal/i }).click();
  const goalDialog = page.getByRole('dialog', { name: /new goal/i });
  await expect(goalDialog).toBeVisible();
  await goalDialog.getByLabel(/^title/i).fill('Learn TypeScript');
  await goalDialog.getByLabel(/target credits/i).fill('1000');
  await goalDialog.getByLabel(/target date/i).fill('2027-01-01');

  const goalCategory = goalDialog.getByRole('combobox', { name: /category/i });
  await goalCategory.fill('Study');
  await goalDialog.getByRole('option', { name: /create "?study"?/i }).click();

  const labelInput = goalDialog.getByLabel(/add label/i);
  await labelInput.fill('Urgent');
  await labelInput.press('Enter');
  await labelInput.fill('2026');
  await labelInput.press('Enter');
  await goalDialog.getByRole('button', { name: /create goal/i }).click();
  await expect(goalDialog).toBeHidden();

  const card = page.locator('article').filter({ hasText: 'Learn TypeScript' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Study')).toBeVisible();
  await expect(card.getByText('Urgent')).toBeVisible();
  await expect(card.getByText('2026')).toBeVisible();
  await expect(card.getByText('0 / 1,000 Credits — 0%')).toBeVisible();

  // Log credits against it.
  await card.getByRole('button', { name: /add credits/i }).click();
  const txnDialog = page.getByRole('dialog', { name: /add credits/i });
  await expect(txnDialog.getByRole('combobox', { name: /category/i })).toHaveValue('Study');
  await txnDialog.getByLabel(/^credits/i).fill('350');
  await txnDialog.getByLabel(/note/i).fill('First sprint');
  await txnDialog.getByRole('button', { name: /add transaction/i }).click();
  await expect(txnDialog).toBeHidden();

  await expect(card.getByText('350 / 1,000 Credits — 35%')).toBeVisible();
  await expect(page.getByText('350 Credits').first()).toBeVisible();

  // Soft clear: active progress resets, history survives.
  await card.getByRole('button', { name: /clear goal/i }).click();
  const clearDialog = page.getByRole('dialog', { name: /clear goal/i });
  await expect(clearDialog).toContainText(/history/i);
  await clearDialog.getByRole('button', { name: /^clear goal$/i }).click();
  await expect(clearDialog).toBeHidden();
  await expect(card.getByText('0 / 1,000 Credits — 0%')).toBeVisible();

  const ledger = page.getByRole('region', { name: /transaction ledger/i });
  await expect(ledger.getByText('+350 Credits')).toBeVisible();
  await expect(ledger.getByText('Cleared').first()).toBeVisible();
  await expect(page.getByText('350 Credits').first()).toBeVisible();

  // Reload: IndexedDB persistence.
  await page.reload();
  await expect(page.locator('article').filter({ hasText: 'Learn TypeScript' })).toContainText('0 / 1,000 Credits — 0%');
  await expect(page.getByRole('region', { name: /transaction ledger/i }).getByText('+350 Credits')).toBeVisible();

  // Export the backup.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /data/i }).click();
  await page.getByRole('menuitem', { name: /export backup/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^conbhan-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const exportPath = '/tmp/opencode/conbhan-e2e-backup.json';
  await download.saveAs(exportPath);
  const raw = JSON.parse(await readFile(exportPath, 'utf8'));
  expect(raw.app).toBe('Conbhan');
  expect(raw.data.goals.some((g: { title: string }) => g.title === 'Learn TypeScript')).toBe(true);
  expect(raw.data.transactions).toHaveLength(1);
  expect(raw.data.transactions[0].isCleared).toBe(1);

  // Add another transaction, then restore the backup (replace-all).
  await card.getByRole('button', { name: /add credits/i }).click();
  const secondDialog = page.getByRole('dialog', { name: /add credits/i });
  await secondDialog.getByLabel(/^credits/i).fill('25');
  await secondDialog.getByRole('button', { name: /add transaction/i }).click();
  await expect(card.getByText('25 / 1,000 Credits — 2.5%')).toBeVisible();

  await page.getByRole('button', { name: /data/i }).click();
  await page.getByRole('menuitem', { name: /import backup/i }).click();
  const importDialog = page.getByRole('dialog', { name: /import backup/i });
  await importDialog.getByLabel(/import backup file/i).setInputFiles(exportPath);
  await expect(importDialog).toContainText(/1 transaction/i);
  await importDialog.getByRole('button', { name: /replace all data/i }).click();
  await expect(importDialog).toBeHidden();
  await expect(page.locator('article').filter({ hasText: 'Learn TypeScript' })).toContainText('0 / 1,000 Credits — 0%');
  await expect(page.getByRole('region', { name: /transaction ledger/i }).getByText('+25 Credits')).toHaveCount(0);
  await expect(page.getByRole('region', { name: /transaction ledger/i }).getByText('+350 Credits')).toBeVisible();
});

test('default goal is protected and the app is usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const defaultCard = page.locator('article').filter({ hasText: 'General Credits' });
  await expect(defaultCard.getByRole('button', { name: /^delete/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /new goal/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /add credits/i }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
