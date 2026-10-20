import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'node:fs/promises';

const BASE = 'http://127.0.0.1:8080/';
const shots = '/home/user/qa/shots';
await fs.mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
const page = await context.newPage();
const problems = [];
page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`[console] ${msg.text()}`); });
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));

async function go(hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForTimeout(500);
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
await page.waitForTimeout(400);

// Create workers first
for (const name of ['Ali Raza', 'Sajid']) {
  await go('#/workers');
  await page.waitForSelector('[data-add-worker]');
  await page.click('[data-add-worker]');
  await page.waitForSelector('#worker-name');
  await page.fill('#worker-name', name);
  await page.click('#worker-form button[type="submit"]');
  await page.waitForTimeout(550);
}

// Seed a realistic month across dates
await addExpense({ section: 'shop', amount: '25000', description: 'Salary — October', worker: 'Ali Raza', type: 'Salary', date: '2026-10-01', time: '10:15' });
await addExpense({ section: 'shop', amount: '18500', description: 'Salary — October', worker: 'Sajid', type: 'Salary', date: '2026-10-01', time: '10:20' });
await addExpense({ section: 'shop', amount: '6200', description: 'Electricity bill', note: 'IESCO, shop meter', date: '2026-10-05', time: '17:40' });
await addExpense({ section: 'shop', amount: '4800', description: 'Shop supplies', date: '2026-10-08', time: '12:05' });
await addExpense({ section: 'shop', amount: '1500', description: 'Workers lunch', date: '2026-10-09', time: '14:10' });
await addExpense({ section: 'shop', amount: '5000', description: 'Advance for Eid', worker: 'Ali Raza', type: 'Advance', date: '2026-10-11', time: '09:30' });
await addExpense({ section: 'shop', amount: '3000', description: 'Advance returned', worker: 'Ali Raza', type: 'Repayment', date: '2026-10-15', time: '18:00' });
await addExpense({ section: 'shop', amount: '35000', description: 'Shop rent', date: '2026-10-17', time: '11:00' });

await addExpense({ section: 'home', amount: '5800', description: 'Groceries', date: '2026-10-02', time: '19:20' });
await addExpense({ section: 'home', amount: '2400', description: 'Chicken', date: '2026-10-06', time: '18:05' });
await addExpense({ section: 'home', amount: '3200', description: 'Beef', note: 'For the weekend', date: '2026-10-06', time: '18:10' });
await addExpense({ section: 'home', amount: '6500', description: 'Electricity bill', date: '2026-10-10', time: '20:00' });
await addExpense({ section: 'home', amount: '4200', description: 'Shopping', date: '2026-10-13', time: '16:30' });
await addExpense({ section: 'home', amount: '1800', description: 'Gas bill', date: '2026-10-18', time: '12:45' });
await addExpense({ section: 'home', amount: '2900', description: 'Mutton', date: '2026-10-19', time: '17:25' });
await addExpense({ section: 'home', amount: '1200.50', description: 'Household supplies', date: '2026-10-20', time: '09:05' });

await go('#/overview');
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/10-dashboard-data.png`, fullPage: true });

await go('#/shop');
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/11-shop.png`, fullPage: true });

await go('#/home');
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/12-home.png`, fullPage: true });

await go('#/add?section=shop');
await page.waitForTimeout(600);
await page.fill('#expense-amount', '1250');
await page.fill('#expense-description', 'Workers lunch');
await page.screenshot({ path: `${shots}/13-add-form.png`, fullPage: true });

await go('#/history');
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/14-history.png`, fullPage: true });

await go('#/workers');
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/15-workers.png`, fullPage: true });

await page.locator('.worker-card', { hasText: 'Ali Raza' }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/16-worker-detail.png`, fullPage: true });

await go('#/reports');
await page.waitForTimeout(700);
await page.screenshot({ path: `${shots}/17-reports.png`, fullPage: true });

await go('#/backup');
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/18-backup.png`, fullPage: true });

await go('#/more');
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/19-more.png`, fullPage: true });

// Month picker sheet
await go('#/overview');
await page.click('[data-month-open]');
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}/20-month-picker.png` });
await page.click('.sheet [data-layer-close]');
await page.waitForTimeout(300);

// Small screen check (iPhone SE)
const small = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p2 = await small.newPage();
await p2.goto(BASE, { waitUntil: 'networkidle' });
await p2.waitForSelector('[data-ready="true"]');
await p2.waitForTimeout(500);
const overflow = await p2.evaluate(() => ({
  docWidth: document.documentElement.scrollWidth,
  winWidth: window.innerWidth,
  widest: [...document.querySelectorAll('*')].reduce((worst, el) => {
    const r = el.getBoundingClientRect();
    return r.width > worst.width ? { width: r.width, tag: el.tagName, cls: String(el.className).slice(0, 40) } : worst;
  }, { width: 0, tag: '', cls: '' })
}));
console.log('SMALL SCREEN OVERFLOW:', JSON.stringify(overflow));
await p2.screenshot({ path: `${shots}/21-small-dashboard.png`, fullPage: true });
await p2.evaluate(() => { location.hash = '#/add?section=shop'; });
await p2.waitForTimeout(600);
await p2.screenshot({ path: `${shots}/22-small-form.png`, fullPage: true });
await small.close();

// Horizontal overflow check on iPhone 11 for every screen
const overflowReport = [];
for (const hash of ['#/overview', '#/shop', '#/home', '#/history', '#/workers', '#/reports', '#/backup', '#/more', '#/add?section=shop']) {
  await go(hash);
  const info = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    inner: window.innerWidth,
    bodyScroll: document.body.scrollWidth
  }));
  overflowReport.push(`${hash} → scrollWidth ${info.scrollWidth} / viewport ${info.inner}${info.scrollWidth > info.inner ? '  OVERFLOW!' : ''}`);
}
console.log('OVERFLOW REPORT:\n' + overflowReport.join('\n'));
console.log('--- PROBLEMS ---');
console.log(problems.length ? problems.join('\n') : 'none');

await browser.close();
