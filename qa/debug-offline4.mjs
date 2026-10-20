import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 200)));
page.on('request', (r) => { if (r.resourceType() === 'script' || r.resourceType() === 'document' || r.resourceType() === 'stylesheet') console.log('REQ', r.resourceType(), r.url()); });
page.on('requestfailed', (r) => console.log('FAILED', r.resourceType(), r.url(), r.failure()?.errorText));
await page.goto('http://127.0.0.1:8081/pocketsplit/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(1200);
console.log('--- offline reload ---');
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const state = await page.evaluate(() => ({
  html: typeof window.__pocketsplit,
  app: document.getElementById('app') ? document.getElementById('app').className : null,
  scripts: [...document.scripts].map(s => s.src)
}));
console.log('STATE', JSON.stringify(state));
await browser.close();
