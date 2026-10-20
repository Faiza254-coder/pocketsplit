import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()?.errorText));
await page.goto('http://127.0.0.1:8081/pocketsplit/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(2500);
const info = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const keys = await caches.keys();
  const out = { scope: reg && reg.scope, active: Boolean(reg && reg.active), keys, cached: [], controller: Boolean(navigator.serviceWorker.controller) };
  for (const k of keys) {
    const c = await caches.open(k);
    out.cached = (await c.keys()).map((r) => r.url);
  }
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
