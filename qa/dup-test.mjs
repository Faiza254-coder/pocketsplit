import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');

async function addOnce() {
  await page.evaluate(() => { location.hash = '#/add?section=home'; });
  await page.waitForSelector('#expense-amount');
  await page.fill('#expense-amount', '900');
  await page.fill('#expense-description', 'Milk and bread');
  await page.click('#date-details summary');
  await page.fill('#expense-date', '2026-10-12');
  await page.fill('#expense-time', '09:30');
  await page.click('#save-expense');
  await page.waitForTimeout(500);
}

await addOnce();
await page.waitForTimeout(300);
await page.evaluate(() => { location.hash = '#/home'; });
await page.waitForTimeout(400);
console.log('first save total:', await page.locator('.summary-big').innerText());

await addOnce();
await page.waitForTimeout(400);
const dialogVisible = await page.locator('.dialog').count();
const dialogText = dialogVisible ? await page.locator('.dialog').innerText() : '';
console.log('duplicate dialog shown:', dialogVisible === 1, '|', dialogText.replace(/\n/g, ' | ').slice(0, 120));

// choose "Go back" -> should NOT save
await page.click('[data-dialog-cancel]');
await page.waitForTimeout(500);
const stillOnForm = await page.locator('#expense-amount').count();
await page.evaluate(() => { location.hash = '#/home'; });
await page.waitForTimeout(400);
console.log('after cancel: stayed on form =', stillOnForm === 1, '| total still 900 =', await page.locator('.summary-big').innerText());

// now confirm duplicate
await page.evaluate(() => { location.hash = '#/add?section=home'; });
await page.waitForSelector('#expense-amount');
await page.fill('#expense-amount', '900');
await page.fill('#expense-description', 'Milk and bread');
await page.click('#date-details summary');
await page.fill('#expense-date', '2026-10-12');
await page.fill('#expense-time', '09:30');
await page.click('#save-expense');
await page.waitForTimeout(400);
await page.click('[data-dialog-confirm]');
await page.waitForTimeout(700);
await page.evaluate(() => { location.hash = '#/home'; });
await page.waitForTimeout(400);
console.log('after confirm, total is 1,800:', await page.locator('.summary-big').innerText());
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
