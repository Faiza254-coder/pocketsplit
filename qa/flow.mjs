import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'node:fs/promises';

const BASE = 'http://127.0.0.1:9090/';
const shots = '/home/user/qa/shots';
await fs.mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
const page = await context.newPage();
const problems = [];
page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`[console] ${msg.text()}`); });
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));

const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function go(hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForTimeout(420);
}

async function text(sel) {
  return (await page.locator(sel).first().innerText()).trim();
}

async function addExpense({ section, amount, description, worker = '', type = '', note = '', date = '', time = '' }) {
  await go(`#/add?section=${section}`);
  await page.waitForSelector('#expense-amount');
  await page.fill('#expense-amount', amount);
  await page.fill('#expense-description', description);
  if (worker) {
    await page.click('#worker-details summary');
    await page.selectOption('#expense-worker', { label: worker });
    await page.waitForTimeout(150);
    if (type) await page.selectOption('#expense-payment-type', type);
  }
  if (note) {
    await page.click('#note-details summary');
    await page.fill('#expense-note', note);
  }
  if (date || time) {
    const detailsOpen = await page.locator('#date-details').getAttribute('open');
    if (detailsOpen === null) await page.click('#date-details summary');
    if (date) await page.fill('#expense-date', date);
    if (time) await page.fill('#expense-time', time);
  }
  await page.click('#save-expense');
  await page.waitForTimeout(650);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(400);

/* ---------------- Add shop + home expenses ---------------- */
await addExpense({ section: 'shop', amount: '12500', description: 'Electricity bill', note: 'IESCO October' });
check('Shop expense saved (toast/route)', await page.evaluate(() => location.hash.includes('/shop')), await page.evaluate(() => location.hash));
let shopTotal = await text('.summary-big');
check('Shop total reflects 12,500', shopTotal.includes('12,500'), shopTotal);

await addExpense({ section: 'home', amount: '5800', description: 'Groceries' });
let homeTotal = await text('.summary-big');
check('Home total reflects 5,800', homeTotal.includes('5,800'), homeTotal);

await addExpense({ section: 'home', amount: '2400.50', description: 'Chicken' });
const dash = await go('#/overview');
await page.waitForTimeout(300);
const heroText = await text('.hero');
check('Dashboard hero total = 20,700.50', heroText.includes('20,700.50'), heroText.replace(/\n/g, ' | '));

/* ---------------- Workers ---------------- */
await go('#/workers');
await page.click('[data-add-worker]');
await page.waitForSelector('#worker-name');
await page.fill('#worker-name', 'Ali Raza');
await page.click('#worker-form button[type="submit"]');
await page.waitForTimeout(600);
check('Worker Ali Raza added', (await page.locator('.worker-card').count()) === 1);

await page.click('[data-add-worker]');
await page.waitForSelector('#worker-name');
await page.fill('#worker-name', 'Sajid');
await page.click('#worker-form button[type="submit"]');
await page.waitForTimeout(600);
check('Worker Sajid added', (await page.locator('.worker-card').count()) === 2);

/* duplicate worker rejected */
await page.click('[data-add-worker]');
await page.waitForSelector('#worker-name');
await page.fill('#worker-name', 'ali raza');
await page.click('#worker-form button[type="submit"]');
await page.waitForTimeout(450);
const dupError = await text('#worker-form [data-error]');
check('Duplicate worker rejected', dupError.toLowerCase().includes('already exists'), dupError);
await page.click('.sheet [data-layer-close]');
await page.waitForTimeout(300);

/* ---------------- Worker payments ---------------- */
await addExpense({ section: 'shop', amount: '25000', description: 'October salary', worker: 'Ali Raza', type: 'Salary' });
await addExpense({ section: 'shop', amount: '5000', description: 'Advance for Eid', worker: 'Ali Raza', type: 'Advance' });
await addExpense({ section: 'shop', amount: '2000', description: 'Advance returned', worker: 'Ali Raza', type: 'Repayment' });
await addExpense({ section: 'shop', amount: '18000', description: 'October salary', worker: 'Sajid', type: 'Salary' });
await addExpense({ section: 'shop', amount: '1500', description: 'Workers lunch' });

/* Verify shop total excludes repayment */
await go('#/shop');
const shopSummary = await text('.section-summary');
check('Shop total excludes repayment (62,000)', shopSummary.includes('62,000') && shopSummary.includes('2,000 repaid'), shopSummary.replace(/\n/g, ' | '));

/* Worker detail */
await go('#/workers');
const workerCards = await page.locator('.worker-card').allInnerTexts();
const aliCard = workerCards.find((c) => c.includes('Ali Raza'));
check('Ali Raza card shows 2 payments + 1 repaid', /2 payments · 1 repaid/.test(aliCard), aliCard.replace(/\n/g, ' | '));
await page.locator('.worker-card', { hasText: 'Ali Raza' }).click();
await page.waitForTimeout(600);
const workerStats = await text('.worker-stats');
check('Worker stats: paid 30,000 / repaid 2,000 / net 28,000',
  workerStats.includes('30,000') && workerStats.includes('2,000') && workerStats.includes('28,000'),
  workerStats.replace(/\n/g, ' | '));
await page.screenshot({ path: `${shots}/05-worker-detail.png`, fullPage: true });

/* ---------------- Edit & delete ---------------- */
await go('#/history');
const rows = await page.locator('.tx-row').count();
check('History lists 8 records (7 expenses + 1 repayment)', rows === 8, String(rows));

/* Edit the electricity bill */
await page.locator('.tx-row', { hasText: 'Electricity bill' }).click();
await page.waitForSelector('#expense-amount');
const amountVal = await page.inputValue('#expense-amount');
check('Edit form prefilled with 12500', amountVal === '12500', amountVal);
await page.fill('#expense-amount', '13000');
await page.click('#save-expense');
await page.waitForTimeout(650);
await go('#/shop');
const editedSummary = await text('.section-summary');
check('Edit updates shop total (62,500)', editedSummary.includes('62,500'), editedSummary.replace(/\n/g, ' | '));

/* Delete the chicken entry */
await go('#/history');
await page.locator('.tx-row', { hasText: 'Chicken' }).click();
await page.waitForSelector('[data-delete]');
await page.click('[data-delete]');
await page.waitForSelector('.dialog');
const dialogText = await text('.dialog');
check('Delete asks for confirmation', dialogText.includes('Delete this expense'), dialogText.replace(/\n/g, ' | '));
await page.click('[data-dialog-confirm]');
await page.waitForTimeout(700);
await go('#/overview');
const heroAfterDelete = await text('.hero');
check('Delete updates dashboard total (68,300)', heroAfterDelete.includes('68,300'), heroAfterDelete.replace(/\n/g, ' | '));

/* ---------------- Validation ---------------- */
await go('#/add?section=shop');
await page.fill('#expense-amount', 'abc');
await page.fill('#expense-description', '');
await page.click('#save-expense');
await page.waitForTimeout(400);
const amountError = await text('[data-field="amount"] [data-error]');
const descError = await text('[data-field="description"] [data-error]');
check('Invalid amount rejected', amountError.length > 3, amountError);
check('Empty description rejected', descError.length > 3, descError);

await page.fill('#expense-amount', '-50');
await page.fill('#expense-description', 'Negative test');
await page.click('#save-expense');
await page.waitForTimeout(300);
const negError = await text('[data-field="amount"] [data-error]');
check('Negative amount rejected', negError.toLowerCase().includes('numbers only') || negError.toLowerCase().includes('greater than zero'), negError);

/* future date rejected */
await page.fill('#expense-amount', '100');
await page.fill('#expense-description', 'Future test');
await page.click('#date-details summary');
await page.fill('#expense-date', '2027-01-01');
await page.click('#save-expense');
await page.waitForTimeout(300);
const dateError = await text('[data-field="date"] [data-error]');
check('Future date rejected', dateError.toLowerCase().includes('future'), dateError);

/* ---------------- Search & filters ---------------- */
await go('#/history');
await page.fill('#history-search', 'salary');
await page.waitForTimeout(500);
const searchRows = await page.locator('.tx-row').count();
const searchText = await page.locator('#history-list').innerText();
check('Search "salary" finds 2 worker salaries', searchRows === 2, `${searchRows} rows`);
check('Search results exclude lunch', !searchText.includes('Workers lunch'));

const summaryText = await page.locator('#history-summary').innerText();
check('Search summary shows filtered total 43,000', summaryText.includes('43,000'), summaryText.replace(/\n/g, ' | '));

/* section filter */
await page.fill('#history-search', '');
await page.waitForTimeout(450);
await page.click('[data-section-filter="home"]');
await page.waitForTimeout(450);
const homeRows = await page.locator('.tx-row').count();
check('Home filter shows only remaining home records', homeRows === 1, `${homeRows} rows (chicken deleted)`);

/* range filter */
await page.click('#range-button');
await page.waitForSelector('.sheet');
await page.click('[data-preset="today"]');
await page.click('[data-apply]');
await page.waitForTimeout(500);
const rangeLabel = await text('#range-label');
check('Range filter applies Today', rangeLabel === 'Today', rangeLabel);

/* ---------------- Reports ---------------- */
await go('#/reports?period=month');
await page.waitForTimeout(600);
const reportHero = await text('.report-hero');
check('Report total equals 62,500 shop + 5,800 home', reportHero.includes('68,300'), reportHero.replace(/\n/g, ' | '));
const reportSplit = await page.locator('.report-split').innerText();
check('Report split shows shop 62,500', reportSplit.includes('62,500'), reportSplit.replace(/\n/g, ' | '));
await page.screenshot({ path: `${shots}/07-reports.png`, fullPage: true });

const workerSection = await page.locator('.report-worker').allInnerTexts();
check('Report lists both workers', workerSection.length === 2, `${workerSection.length}`);

/* ---------------- Persistence after reload ---------------- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(500);
await go('#/overview');
const persistedHero = await text('.hero');
check('Records persist after reload (68,300)', persistedHero.includes('68,300'), persistedHero.replace(/\n/g, ' | '));

await browser.close();
console.log(results.join('\n'));
console.log('\n--- PROBLEMS ---');
console.log(problems.length ? problems.join('\n') : 'none');

