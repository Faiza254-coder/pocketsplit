import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('response', (r) => { if (r.status() >= 400) console.log('BAD', r.status(), r.url()); });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:8081/pocketsplit/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(1200);
await page.evaluate(() => { location.hash = '#/add?section=shop'; });
await page.waitForSelector('#expense-amount');
await page.fill('#expense-amount', '450');
await page.fill('#expense-description', 'Sub-path test');
await page.click('#save-expense');
await page.waitForTimeout(700);
await page.evaluate(() => { location.hash = '#/overview'; });
await page.waitForTimeout(400);
for (const h of ['#/shop','#/home','#/history','#/reports','#/backup','#/more']) {
  await page.evaluate((x) => { location.hash = x; }, h);
  await page.waitForTimeout(280);
}
console.log('--- offline reload ---');
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(700);
  const t = await page.locator('.hero-amount .num, .page-title').first().innerText().catch(() => '');
  console.log(`t+${(i+1)*700}ms:`, JSON.stringify(t.slice(0, 40)));
}
await browser.close();
