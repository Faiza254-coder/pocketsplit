import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = 'http://127.0.0.1:8080/';
const results = [];
const problems = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
const page = await context.newPage();
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));
page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`[console] ${msg.text()}`); });

const go = async (hash) => { await page.evaluate((h) => { window.location.hash = h; }, hash); await page.waitForTimeout(450); };

async function add({ section, amount, description, date, time, worker, type, note }) {
  await go(`#/add?section=${section}`);
  await page.waitForSelector('#expense-amount');
  await page.fill('#expense-amount', amount);
  await page.fill('#expense-description', description);
  if (worker) {
    await page.click('#worker-details summary');
    await page.selectOption('#expense-worker', { label: worker });
    await page.waitForTimeout(120);
    if (type) await page.selectOption('#expense-payment-type', type);
  }
  if (note) { await page.click('#note-details summary'); await page.fill('#expense-note', note); }
  if (date) {
    await page.click('#date-details summary');
    await page.fill('#expense-date', date);
    if (time) await page.fill('#expense-time', time);
  }
  await page.click('#save-expense');
  await page.waitForTimeout(520);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(600);

/* --------- Decimal precision --------- */
await add({ section: 'home', amount: '0.10', description: 'Precision A' });
await add({ section: 'home', amount: '0.20', description: 'Precision B' });
await add({ section: 'home', amount: '100.05', description: 'Precision C' });
await go('#/home');
let total = await page.locator('.summary-big').innerText();
check('Decimal paisa totals are exact (100.35)', total.includes('100.35'), total);

/* --------- 3-decimal and exponent rejected --------- */
await go('#/add?section=home');
await page.fill('#expense-amount', '10.555');
await page.fill('#expense-description', 'Three decimals');
await page.click('#save-expense');
await page.waitForTimeout(300);
check('Three decimal places rejected', (await page.locator('[data-field="amount"] [data-error]').innerText()).includes('two decimal'), await page.locator('[data-field="amount"] [data-error]').innerText());

await page.fill('#expense-amount', '1e5');
await page.click('#save-expense');
await page.waitForTimeout(300);
check('Exponent notation rejected', (await page.locator('[data-field="amount"] [data-error]').innerText()).length > 5, await page.locator('[data-field="amount"] [data-error]').innerText());

/* --------- Thousands separator accepted --------- */
await page.fill('#expense-amount', '1,250');
await page.fill('#expense-description', 'Comma amount');
await page.click('#save-expense');
await page.waitForTimeout(600);
await go('#/home');
total = await page.locator('.summary-big').innerText();
check('Commas accepted in amount (1,350.35)', total.includes('1,350.35'), total);

/* --------- Month navigation --------- */
await go('#/home');
const labelNow = await page.locator('[data-month-label]').innerText();
await page.click('[data-month-prev]');
await page.waitForTimeout(500);
const labelPrev = await page.locator('[data-month-label]').innerText();
check('Previous month navigation works', labelPrev !== labelNow, `${labelNow} → ${labelPrev}`);
const prevEmpty = await page.locator('#view').innerText();
check('Empty previous month shows empty state', /No home expenses in/.test(prevEmpty), prevEmpty.split('\n').slice(0, 6).join(' | '));
const nextDisabledAfterBack = await page.evaluate(() => {
  const back = document.querySelector('[data-month-next]');
  return back ? back.disabled : null;
});
await page.click('[data-month-next]');
await page.waitForTimeout(500);
check('Next month returns to current and disables at current',
  (await page.locator('[data-month-label]').innerText()) === labelNow && nextDisabledAfterBack === false,
  String(nextDisabledAfterBack));

/* --------- Worker quick payment preselects worker + type --------- */
await go('#/workers');
await page.click('[data-add-worker]');
await page.waitForSelector('#worker-name');
await page.fill('#worker-name', 'Imran');
await page.click('#worker-form button[type="submit"]');
await page.waitForTimeout(600);
await page.locator('.worker-card', { hasText: 'Imran' }).click();
await page.waitForTimeout(600);
await page.locator('.payment-quick', { hasText: 'Advance' }).click();
await page.waitForTimeout(600);
const preselectedWorker = await page.inputValue('#expense-worker');
const preselectedType = await page.inputValue('#expense-payment-type');
check('Quick payment link preselects worker and type', Boolean(preselectedWorker) && preselectedType === 'Advance', `${preselectedWorker} / ${preselectedType}`);
await page.fill('#expense-amount', '3000');
await page.fill('#expense-description', 'Advance for medical');
await page.click('#save-expense');
await page.waitForTimeout(700);
check('Saving from worker quick link returns to worker ledger', (await page.evaluate(() => location.hash)).includes('/workers/'), await page.evaluate(() => location.hash));

/* --------- Worker delete blocked when payments exist --------- */
await go('#/workers');
await page.locator('.worker-card', { hasText: 'Imran' }).click();
await page.waitForTimeout(500);
await page.locator('[data-edit-worker]').click();
await page.waitForSelector('#worker-name');
const blockedText = await page.locator('.sheet').innerText();
check('Worker with payments shows delete-blocked explanation', blockedText.includes('cannot be deleted'), blockedText.split('\n').filter((l) => l.includes('deleted')).join(' | '));

/* rename worker */
await page.fill('#worker-name', 'Imran Khan');
await page.click('#worker-form button[type="submit"]');
await page.waitForTimeout(800);
const renamedHeader = await page.locator('.page-title').innerText();
check('Worker rename reflects in header', renamedHeader.includes('Imran Khan'), renamedHeader);
const historySnapshot = await page.evaluate(async () => {
  const txns = await new Promise((resolve) => {
    const req = indexedDB.open('pocketsplit');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('transactions', 'readonly');
      const all = tx.objectStore('transactions').getAll();
      all.onsuccess = () => resolve(all.result);
    };
  });
  return txns.filter((t) => t.workerName === 'Imran Khan').length;
});
check('Rename updates worker name on linked payments', historySnapshot === 1, String(historySnapshot));

/* --------- Search by worker name --------- */
await go('#/history');
await page.fill('#history-search', 'imran');
await page.waitForTimeout(500);
const rows = await page.locator('.tx-row').count();
check('Search finds payments by worker name', rows === 1, String(rows));

/* --------- Date range boundaries: today only --------- */
await go('#/reports?period=today');
await page.waitForTimeout(600);
const todayTotal = await page.locator('.report-total').innerText();
check('Today report total is 4,350.35', todayTotal.replace(/\s/g, '').includes('4,350.35'), todayTotal.replace(/\n/g, ' '));

/* --------- Report: custom range validation --------- */
await go('#/reports?period=custom&start=2026-10-01&end=2026-10-05');
await page.waitForTimeout(600);
const customText = await page.locator('.report-period-label').innerText();
check('Custom report shows date range', customText.includes('1 Oct') && customText.includes('5 Oct'), customText);

/* --------- Shop vs Home isolation --------- */
await go('#/add?section=shop');
await page.fill('#expense-amount', '99');
await page.fill('#expense-description', 'Shop only test');
await page.click('#save-expense');
await page.waitForTimeout(600);
const shopTotals = await page.evaluate(() => Number(document.querySelector('.summary-big').innerText.replace(/[^0-9.]/g, '')));
await go('#/home');
const homeTotals = await page.evaluate(() => Number(document.querySelector('.summary-big').innerText.replace(/[^0-9.]/g, '')));
check('Shop and Home totals stay isolated', shopTotals === 3099 && homeTotals === 1350.35, `shop ${shopTotals} (3,000 advance + 99) / home ${homeTotals}`);

/* --------- Data persistence across a brand new browser context is NOT expected --------- */
check('No console errors during edge tests', problems.length === 0, problems.join(' || ').slice(0, 300));

await browser.close();
console.log(results.join('\n'));
console.log('\n--- PROBLEMS ---');
console.log(problems.length ? problems.join('\n') : 'none');
