import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/*
 * End-to-end checks for PocketSplit.
 * Each test starts with a clean browser context, so IndexedDB begins empty.
 */

async function addExpense(page, { section = 'shop', amount, description, worker, type, note, date, time }) {
  await page.evaluate((hash) => { window.location.hash = hash; }, `#/add?section=${section}`);
  await page.waitForSelector('#expense-amount');
  await page.fill('#expense-amount', amount);
  await page.fill('#expense-description', description);
  if (worker) {
    await page.click('#worker-details summary');
    await page.selectOption('#expense-worker', { label: worker });
    if (type) await page.selectOption('#expense-payment-type', type);
  }
  if (note) {
    await page.click('#note-details summary');
    await page.fill('#expense-note', note);
  }
  if (date) {
    await page.click('#date-details summary');
    await page.fill('#expense-date', date);
    if (time) await page.fill('#expense-time', time);
  }
  await page.click('#save-expense');
  await page.waitForTimeout(500);
}

async function addWorker(page, name) {
  await page.evaluate(() => { window.location.hash = '#/workers'; });
  await page.waitForSelector('[data-add-worker]');
  await page.click('[data-add-worker]');
  await page.waitForSelector('#worker-name');
  await page.fill('#worker-name', name);
  await page.click('#worker-form button[type="submit"]');
  await page.waitForTimeout(500);
}

async function open(page, hash = '#/overview') {
  await page.goto('/');
  await page.waitForSelector('[data-ready="true"]');
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForTimeout(400);
}

test('dashboard starts empty with no hardcoded figures', async ({ page }) => {
  await open(page);
  await expect(page.locator('.hero-amount .num')).toHaveText('0');
  await expect(page.getByText('Your diary is empty')).toHaveCount(0);
  await expect(page.getByText('Two pockets, one diary')).toBeVisible();
});

test('add a shop and a home expense and see correct totals', async ({ page }) => {
  await open(page);
  await addExpense(page, { section: 'shop', amount: '12500', description: 'Electricity bill' });
  await expect(page.locator('.summary-big')).toContainText('12,500');
  await addExpense(page, { section: 'home', amount: '5800', description: 'Groceries' });
  await expect(page.locator('.summary-big')).toContainText('5,800');
  await open(page);
  await expect(page.locator('.hero-amount .num')).toHaveText('18,300');
});

test('amount validation rejects bad input and accepts decimals', async ({ page }) => {
  await open(page, '#/add?section=shop');
  await page.fill('#expense-amount', 'abc');
  await page.fill('#expense-description', 'Test');
  await page.click('#save-expense');
  await expect(page.locator('[data-field="amount"] [data-error]')).toBeVisible();

  await page.fill('#expense-amount', '12.345');
  await page.click('#save-expense');
  await expect(page.locator('[data-field="amount"] [data-error]')).toContainText('two decimal');

  await page.fill('#expense-amount', '0.10');
  await page.click('#save-expense');
  await page.waitForTimeout(600);
  await expect(page.locator('.summary-big')).toContainText('0.10');
});

test('workers, payments and repayments keep separate totals', async ({ page }) => {
  await open(page);
  await addWorker(page, 'Ali Raza');
  await addExpense(page, { section: 'shop', amount: '25000', description: 'Salary', worker: 'Ali Raza', type: 'Salary' });
  await addExpense(page, { section: 'shop', amount: '5000', description: 'Advance', worker: 'Ali Raza', type: 'Advance' });
  await addExpense(page, { section: 'shop', amount: '2000', description: 'Returned', worker: 'Ali Raza', type: 'Repayment' });

  await page.evaluate(() => { window.location.hash = '#/shop'; });
  await page.waitForTimeout(400);
  await expect(page.locator('.section-summary')).toContainText('30,000');
  await expect(page.locator('.section-summary')).toContainText('2,000 repaid');

  await page.evaluate(() => { window.location.hash = '#/workers'; });
  await page.waitForTimeout(300);
  await page.locator('.worker-card').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('.worker-stats')).toContainText('30,000');
  await expect(page.locator('.worker-stats')).toContainText('28,000');
});

test('edit and delete update totals immediately', async ({ page }) => {
  await open(page);
  await addExpense(page, { section: 'home', amount: '1000', description: 'Chicken' });
  await open(page, '#/history');
  await page.locator('.tx-row', { hasText: 'Chicken' }).click();
  await page.waitForSelector('#expense-amount');
  await page.fill('#expense-amount', '1500');
  await page.click('#save-expense');
  await page.waitForTimeout(600);
  await open(page);
  await expect(page.locator('.hero-amount .num')).toHaveText('1,500');

  await page.evaluate(() => { window.location.hash = '#/history'; });
  await page.waitForTimeout(300);
  await page.locator('.tx-row', { hasText: 'Chicken' }).click();
  await page.waitForSelector('[data-delete]');
  await page.click('[data-delete]');
  await page.click('[data-dialog-confirm]');
  await page.waitForTimeout(700);
  await open(page);
  await expect(page.locator('.hero-amount .num')).toHaveText('0');
});

test('search and filters narrow results', async ({ page }) => {
  await open(page);
  await addExpense(page, { section: 'shop', amount: '100', description: 'Shop tea' });
  await addExpense(page, { section: 'home', amount: '200', description: 'Home tea' });
  await addExpense(page, { section: 'home', amount: '300', description: 'Chicken' });
  await open(page, '#/history');

  await page.fill('#history-search', 'tea');
  await page.waitForTimeout(450);
  await expect(page.locator('.tx-row')).toHaveCount(2);

  await page.fill('#history-search', '');
  await page.waitForTimeout(450);
  await page.click('[data-section-filter="shop"]');
  await page.waitForTimeout(400);
  await expect(page.locator('.tx-row')).toHaveCount(1);
});

test('records persist after reload', async ({ page }) => {
  await open(page);
  await addExpense(page, { section: 'home', amount: '4321', description: 'Persisted' });
  await page.reload();
  await page.waitForSelector('[data-ready="true"]');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.location.hash = '#/overview'; });
  await page.waitForTimeout(400);
  await expect(page.locator('.hero-amount .num')).toHaveText('4,321');
});

test('backup export, duplicate-safe merge and full restore', async ({ page }) => {
  await open(page);
  await addWorker(page, 'Sajid');
  await addExpense(page, { section: 'shop', amount: '18000', description: 'Salary', worker: 'Sajid', type: 'Salary' });
  await addExpense(page, { section: 'home', amount: '2200', description: 'Groceries' });

  await page.evaluate(() => { window.location.hash = '#/backup'; });
  await page.waitForTimeout(400);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#download-backup')
  ]);
  const file = path.join(os.tmpdir(), `pocketsplit-test-${Date.now()}.json`);
  await download.saveAs(file);
  const payload = JSON.parse(await fs.readFile(file, 'utf8'));
  expect(payload.app).toBe('pocketsplit');
  expect(payload.summary.totalExpenses).toBe(20200);

  // Re-import the same file: nothing should be added.
  await page.setInputFiles('#restore-file', file);
  await page.waitForSelector('.restore-preview');
  await page.click('#restore-now');
  await page.click('[data-dialog-confirm]');
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.location.hash = '#/overview'; });
  await page.waitForTimeout(400);
  await expect(page.locator('.hero-amount .num')).toHaveText('20,200');

  // Erase then restore.
  await page.evaluate(() => { window.location.hash = '#/backup'; });
  await page.waitForTimeout(400);
  await page.click('#erase-data');
  await page.click('[data-dialog-confirm]');
  await page.waitForTimeout(800);
  await page.setInputFiles('#restore-file', file);
  await page.waitForSelector('.restore-preview');
  await page.click('#restore-now');
  await page.click('[data-dialog-confirm]');
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.location.hash = '#/overview'; });
  await page.waitForTimeout(400);
  await expect(page.locator('.hero-amount .num')).toHaveText('20,200');
});

test('corrupted backup is rejected without touching data', async ({ page }) => {
  await open(page);
  await addExpense(page, { section: 'home', amount: '500', description: 'Safe record' });
  const broken = path.join(os.tmpdir(), `pocketsplit-broken-${Date.now()}.json`);
  await fs.writeFile(broken, '{"app":"pocketsplit","format":1,"data":{"worke');
  await page.evaluate(() => { window.location.hash = '#/backup'; });
  await page.waitForTimeout(400);
  await page.setInputFiles('#restore-file', broken);
  await page.waitForTimeout(500);
  await expect(page.locator('#restore-area')).toContainText('cannot be restored');
  await page.evaluate(() => { window.location.hash = '#/overview'; });
  await page.waitForTimeout(400);
  await expect(page.locator('.hero-amount .num')).toHaveText('500');
});

test('app reopens and saves while offline', async ({ page, context }) => {
  await open(page);
  await addExpense(page, { section: 'shop', amount: '750', description: 'Online record' });
  await page.waitForTimeout(1200);
  for (const hash of ['#/shop', '#/home', '#/history', '#/reports', '#/backup']) {
    await page.evaluate((h) => { window.location.hash = h; }, hash);
    await page.waitForTimeout(250);
  }
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.location.hash = '#/add?section=home'; });
  await page.waitForSelector('#expense-amount');
  await page.fill('#expense-amount', '250');
  await page.fill('#expense-description', 'Offline record');
  await page.click('#save-expense');
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.location.hash = '#/overview'; });
  await page.waitForTimeout(400);
  await expect(page.locator('.hero-amount .num')).toHaveText('1,000');
  await context.setOffline(false);
});

test('layout does not scroll horizontally on an iPhone screen', async ({ page }) => {
  await open(page);
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);
});
