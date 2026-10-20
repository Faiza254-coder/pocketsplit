import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = 'http://127.0.0.1:8081/pocketsplit/';
const results = [];
const problems = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
const page = await context.newPage();
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`[console] ${m.text()}`); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');
await page.waitForTimeout(1200);

const scope = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.scope : null;
});
check('Service worker scope matches sub-path deployment', scope === 'http://127.0.0.1:8081/pocketsplit/', String(scope));

const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
check('Manifest uses relative path', manifestHref === './manifest.webmanifest', manifestHref);

const manifest = await page.evaluate(async () => {
  const res = await fetch('./manifest.webmanifest');
  return res.json();
});
check('Manifest start_url relative and display standalone', manifest.start_url === './' && manifest.display === 'standalone', `${manifest.start_url} / ${manifest.display}`);
const iconsOk = await page.evaluate(async (icons) => {
  const results = [];
  for (const icon of icons) {
    const res = await fetch(icon.src);
    results.push(`${res.status}:${icon.sizes}`);
  }
  return results;
}, manifest.icons);
check('All manifest icons load from sub-path', iconsOk.every((r) => r.startsWith('200')), iconsOk.join(', '));

// Add an expense to prove IndexedDB works from a sub-path.
await page.evaluate(() => { location.hash = '#/add?section=shop'; });
await page.waitForSelector('#expense-amount');
await page.fill('#expense-amount', '450');
await page.fill('#expense-description', 'Sub-path test');
await page.click('#save-expense');
await page.waitForTimeout(700);
await page.evaluate(() => { location.hash = '#/overview'; });
await page.waitForTimeout(400);
check('Expense saves under GitHub-Pages-style sub-path', (await page.locator('.hero-amount .num').innerText()) === '450');

// Offline reload from the sub-path.
for (const hash of ['#/shop', '#/home', '#/history', '#/reports', '#/backup', '#/more']) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(280);
}
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
const ready = await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 12000 }).then(() => true).catch(() => false);
const offlineTitle = await page.title();
check('Offline reload works from sub-path', ready && offlineTitle.length > 0, offlineTitle);
await context.setOffline(false);

// Accessibility basics: names on interactive controls
const unnamed = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('button, a[href], input, select, textarea').forEach((el) => {
    if (el.closest('.sprite')) return;
    const name = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title')
      || (el.labels && el.labels.length ? el.labels[0].innerText : '') || el.getAttribute('placeholder') || '';
    if (!name) bad.push(`${el.tagName}.${String(el.className).slice(0, 30)}`);
  });
  return bad;
});
check('All visible controls have accessible names', unnamed.length === 0, unnamed.slice(0, 6).join(' | '));

const realProblems = problems.filter((p) => !/status of 504/.test(p));
check('No console errors under sub-path', realProblems.length === 0, realProblems.join(' || ').slice(0, 300));

await browser.close();
console.log(results.join('\n'));
