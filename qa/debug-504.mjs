import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('response', (r) => { if (r.status() === 504) console.log('504 URL:', r.url(), 'type:', r.request().resourceType()); });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:8081/pocketsplit/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(800);
await page.evaluate(() => { location.hash = '#/add?section=shop'; });
await page.waitForSelector('#expense-amount');
await page.fill('#expense-amount', '450');
await page.fill('#expense-description', 'Sub-path test');
await page.click('#save-expense');
await page.waitForTimeout(600);
await page.evaluate(() => { location.hash = '#/overview'; });
await page.waitForTimeout(300);
for (const h of ['#/shop','#/home','#/history','#/reports','#/backup','#/more']) {
  await page.evaluate((x) => { location.hash = x; }, h);
  await page.waitForTimeout(250);
}
await context.setOffline(true);
console.log('--- offline reload ---');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 10000 }).catch(() => console.log('NOT READY'));
console.log('title', await page.title());
await page.waitForTimeout(1500);
await browser.close();
