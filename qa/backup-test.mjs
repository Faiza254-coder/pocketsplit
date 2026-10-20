import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://127.0.0.1:9090/';
const tmp = '/home/user/qa/tmp';
await fs.mkdir(tmp, { recursive: true });
const results = [];
const problems = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
const page = await context.newPage();
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));
page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`[console] ${msg.text()}`); });

async function go(hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForTimeout(450);
}
async function heroTotal() {
  await go('#/overview');
  await page.waitForTimeout(350);
  return (await page.locator('.hero-amount .num').innerText()).trim();
}
async function addExpense({ section, amount, description, date, time, workerLabel, type }) {
  await go(`#/add?section=${section}`);
  await page.waitForSelector('#expense-amount');
  await page.fill('#expense-amount', amount);
  await page.fill('#expense-description', description);
  if (workerLabel) {
    await page.click('#worker-details summary');
    await page.selectOption('#expense-worker', { label: workerLabel });
    await page.waitForTimeout(120);
    if (type) await page.selectOption('#expense-payment-type', type);
  }
  if (date) {
    await page.click('#date-details summary');
    await page.fill('#expense-date', date);
    if (time) await page.fill('#expense-time', time);
  }
  await page.click('#save-expense');
  await page.waitForTimeout(550);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(800);

/* seed workers + transactions */
for (const name of ['Ali Raza', 'Sajid']) {
  await go('#/workers');
  await page.click('[data-add-worker]');
  await page.waitForSelector('#worker-name');
  await page.fill('#worker-name', name);
  await page.click('#worker-form button[type="submit"]');
  await page.waitForTimeout(450);
}
await addExpense({ section: 'shop', amount: '25000', description: 'Salary October', workerLabel: 'Ali Raza', type: 'Salary', date: '2026-10-01', time: '10:00' });
await addExpense({ section: 'shop', amount: '3200', description: 'Electricity bill', date: '2026-10-05', time: '18:30' });
await addExpense({ section: 'shop', amount: '1500', description: 'Tea for workers', date: '2026-10-06', time: '11:15' });
await addExpense({ section: 'home', amount: '5400.75', description: 'Groceries', date: '2026-10-07', time: '19:45' });
await addExpense({ section: 'home', amount: '2200', description: 'Chicken', date: '2026-10-08', time: '17:20' });
const originalTotal = await heroTotal();
check('Seeded total is 37,300.75', originalTotal === '37,300.75', originalTotal);

/* ---------------- Export ---------------- */
await go('#/backup');
await page.waitForTimeout(400);
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#download-backup')
]);
const backupPath = path.join(tmp, 'pocketsplit-export.json');
await download.saveAs(backupPath);
const raw = await fs.readFile(backupPath, 'utf8');
const parsed = JSON.parse(raw);
check('Backup file downloads as .json', /^PocketSplit-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
check('Backup has correct envelope', parsed.app === 'pocketsplit' && parsed.format === 1 && parsed.currency === 'PKR');
check('Backup contains 5 transactions and 2 workers', parsed.data.transactions.length === 5 && parsed.data.workers.length === 2, `${parsed.data.transactions.length}/${parsed.data.workers.length}`);
check('Backup checksum present', /^fnv1a:[0-9a-f]{8}$/.test(parsed.checksum), parsed.checksum);
check('Backup summary total is 37,300.75', Number(parsed.summary.totalExpenses) === 37300.75, String(parsed.summary.totalExpenses));
const linkOk = parsed.data.transactions.filter((t) => t.workerId).every((t) => parsed.data.workers.some((w) => w.id === t.workerId));
check('Worker links resolve inside backup', linkOk);
await page.waitForTimeout(700);
const exportNote = await page.locator('#export-feedback').innerText().catch(() => '');
check('Export success message shown only after export', exportNote.includes('Backup file created'), exportNote.replace(/\n/g, ' | '));

/* ---------------- Merge re-import (duplicates skipped) ---------------- */
await page.setInputFiles('#restore-file', backupPath);
await page.waitForSelector('.restore-preview');
await page.click('#restore-now');
await page.waitForSelector('.dialog');
await page.click('[data-dialog-confirm]');
await page.waitForTimeout(1200);
const mergeMsg = await page.locator('#restore-card, .alert-success').first().innerText().catch(() => '');
const mergeAlert = await page.locator('.alert-success').first().innerText().catch(() => '');
check('Merge reports skipped duplicates', /skipped|0 transaction/i.test(mergeAlert), mergeAlert.replace(/\n/g, ' | '));
const afterMerge = await heroTotal();
check('Importing the same backup does not double-count', afterMerge === originalTotal, afterMerge);

/* ---------------- Corrupted file rejected ---------------- */
const corrupted = raw.slice(0, Math.floor(raw.length * 0.6));
const corruptPath = path.join(tmp, 'corrupted.json');
await fs.writeFile(corruptPath, corrupted);
await go('#/backup');
await page.setInputFiles('#restore-file', corruptPath);
await page.waitForTimeout(600);
const corruptMsg = await page.locator('#restore-area').innerText();
check('Truncated file rejected with clear message', /cannot be restored|not valid JSON|integrity check/i.test(corruptMsg), corruptMsg.split('\n').slice(0, 3).join(' | '));

/* ---------------- Edited data fails checksum ---------------- */
const tampered = JSON.parse(raw);
tampered.data.transactions[0].amount = 1;
const tamperedPath = path.join(tmp, 'tampered.json');
await fs.writeFile(tamperedPath, JSON.stringify(tampered));
await go('#/backup');
await page.setInputFiles('#restore-file', tamperedPath);
await page.waitForTimeout(600);
const tamperMsg = await page.locator('#restore-area').innerText();
check('Checksum catches edited amount', /integrity check/i.test(tamperMsg), tamperMsg.split('\n').slice(0, 3).join(' | '));

/* ---------------- Broken worker link rejected ---------------- */
const brokenLink = JSON.parse(raw);
delete brokenLink.checksum;
brokenLink.data.transactions[0].workerId = 'ghost-worker-id';
const brokenPath = path.join(tmp, 'broken-link.json');
await fs.writeFile(brokenPath, JSON.stringify(brokenLink));
await go('#/backup');
await page.setInputFiles('#restore-file', brokenPath);
await page.waitForTimeout(600);
const brokenMsg = await page.locator('#restore-area').innerText();
check('Missing worker reference rejected', /missing from this backup/i.test(brokenMsg), brokenMsg.split('\n').slice(0, 4).join(' | '));

/* ---------------- Foreign / newer format rejected ---------------- */
const foreignPath = path.join(tmp, 'foreign.json');
await fs.writeFile(foreignPath, JSON.stringify({ hello: 'world' }));
await go('#/backup');
await page.setInputFiles('#restore-file', foreignPath);
await page.waitForTimeout(500);
check('Non-PocketSplit file rejected', /not a PocketSplit backup/i.test(await page.locator('#restore-area').innerText()));

const newer = { ...JSON.parse(raw), format: 99 };
const newerPath = path.join(tmp, 'newer.json');
await fs.writeFile(newerPath, JSON.stringify(newer));
await go('#/backup');
await page.setInputFiles('#restore-file', newerPath);
await page.waitForTimeout(500);
check('Newer format rejected with guidance', /newer version/i.test(await page.locator('#restore-area').innerText()));

/* ---------------- Erase + restore into empty app ---------------- */
await go('#/backup');
await page.click('#erase-data');
await page.waitForSelector('.dialog');
await page.click('[data-dialog-confirm]');
await page.waitForTimeout(900);
const erasedTotal = await heroTotal();
check('Erase clears all records', erasedTotal === '0', erasedTotal);

await go('#/backup');
await page.setInputFiles('#restore-file', backupPath);
await page.waitForSelector('.restore-preview');
await page.click('#restore-now');
await page.waitForSelector('.dialog');
await page.click('[data-dialog-confirm]');
await page.waitForTimeout(1200);
const restoredTotal = await heroTotal();
check('Full restore reproduces exact total', restoredTotal === originalTotal, restoredTotal);

await go('#/workers');
const workerCount = await page.locator('.worker-card').count();
check('Workers restored', workerCount === 2, String(workerCount));

/* ---------------- Offline capability ---------------- */
await page.waitForTimeout(1500);
const swReady = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(reg && (reg.active || reg.waiting || reg.installing));
});
check('Service worker registered', swReady);

// Warm the cache by visiting each screen once.
for (const hash of ['#/overview', '#/shop', '#/home', '#/history', '#/workers', '#/reports', '#/backup', '#/more']) {
  await go(hash);
}
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1400);
const offlineRendered = await page.locator('.hero, .page-title').first().innerText().catch(() => '');
check('App opens while offline', offlineRendered.length > 0, offlineRendered);

await go('#/add?section=shop');
await page.waitForSelector('#expense-amount');
await page.fill('#expense-amount', '777');
await page.fill('#expense-description', 'Offline test purchase');
await page.click('#save-expense');
await page.waitForTimeout(800);
const offlineTotal = await heroTotal();
check('Expense saves while offline', offlineTotal === '38,077.75', offlineTotal);

await context.setOffline(false);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(600);
const afterOfflineReload = await heroTotal();
check('Offline-saved record survives reconnect + reload', afterOfflineReload === '38,077.75', afterOfflineReload);

check('No console errors during backup/offline tests', problems.length === 0, problems.join(' || ').slice(0, 400));

await browser.close();
console.log(results.join('\n'));
console.log('\n--- PROBLEMS ---');
console.log(problems.length ? problems.join('\n') : 'none');
