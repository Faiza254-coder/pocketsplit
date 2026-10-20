import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('response', (r) => { if (r.status() >= 400) console.log('BAD', r.status(), r.url()); });
page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()?.errorText));
await page.goto('http://127.0.0.1:8081/pocketsplit/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(1500);
for (const h of ['#/shop','#/home','#/history','#/reports','#/backup','#/more']) {
  await page.evaluate((x) => { location.hash = x; }, h);
  await page.waitForTimeout(300);
}
console.log('--- going offline ---');
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
console.log('BODY:', (await page.locator('body').innerText()).slice(0, 300));
console.log('HASH:', await page.evaluate(() => location.hash));
await browser.close();
