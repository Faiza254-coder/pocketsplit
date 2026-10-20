import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR', m.text().slice(0,200)); });
await page.goto('http://127.0.0.1:8081/pocketsplit/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(1500);
await context.setOffline(true);
for (const h of ['#/overview', '#/shop', '#/home', '#/history', '#/workers', '#/reports', '#/backup', '#/more']) {
  await page.evaluate((x) => { location.hash = x; }, h);
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const ok = await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 8000 }).then(() => true).catch(() => false);
  const title = await page.title();
  console.log(h, ok ? 'READY' : 'STUCK', '|', title);
}
await browser.close();
