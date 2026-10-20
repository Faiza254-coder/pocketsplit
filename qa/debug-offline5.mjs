import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto('http://127.0.0.1:8081/pocketsplit/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(1500);
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => ({
  hash: location.hash,
  appClass: document.getElementById('app').className,
  appHTML: document.getElementById('app').innerHTML.slice(0, 700),
  viewHTML: document.getElementById('view') ? document.getElementById('view').innerHTML.slice(0, 300) : 'NO VIEW',
  title: document.title
}));
console.log(JSON.stringify(info, null, 2));
await browser.close();
