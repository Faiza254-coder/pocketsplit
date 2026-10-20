import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
const results = [];
const check = (n, ok, d='') => results.push(`${ok?'PASS':'FAIL'}  ${n}${d?` — ${d}`:''}`);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]');

// Keyboard: open month picker with keyboard, Escape closes it
await page.locator('[data-month-open]').focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('Month picker opens from keyboard', (await page.locator('.sheet').count()) === 1);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('Escape closes the sheet', (await page.locator('.sheet').count()) === 0);

// Focus trap + return focus for confirm dialog
await page.evaluate(() => { location.hash = '#/add?section=shop'; });
await page.waitForSelector('#expense-amount');
await page.fill('#expense-amount', '100');
await page.fill('#expense-description', 'Focus test');
await page.click('#save-expense');
await page.waitForTimeout(700);
await page.evaluate(() => { location.hash = '#/history'; });
await page.waitForTimeout(400);
await page.locator('.tx-row').first().click();
await page.waitForSelector('[data-delete]');
await page.click('[data-delete]');
await page.waitForSelector('.dialog');
await page.waitForTimeout(350);
const focusInside = await page.evaluate(() => {
  const dialog = document.querySelector('.dialog');
  return dialog ? dialog.contains(document.activeElement) : false;
});
const focusedLabel = await page.evaluate(() => document.activeElement ? document.activeElement.textContent.trim().slice(0, 30) : '');
check('Confirm dialog moves focus inside', focusInside, `focused: ${focusedLabel}`);
const focusables = await page.evaluate(() => {
  const d = document.querySelector('.dialog');
  return [...d.querySelectorAll('button, a[href], input')].length;
});
check('Dialog exposes both actions', focusables >= 2, String(focusables));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('Escape cancels the delete dialog', (await page.locator('.dialog').count()) === 0);
const formStillOpen = await page.locator('#expense-amount').count();
check('Cancelled delete keeps the edit form open', formStillOpen === 1, String(formStillOpen));

// Remaining records after cancel
await page.evaluate(() => { location.hash = '#/overview'; });
await page.waitForTimeout(400);
check('Total unchanged after cancelled delete', (await page.locator('.hero-amount .num').innerText()) === '100');

// Tab order: skip link? check main landmark and nav labels
const landmarks = await page.evaluate(() => ({
  main: document.querySelectorAll('main').length,
  nav: document.querySelectorAll('nav[aria-label]').length,
  h1: document.querySelectorAll('h1').length
}));
check('Page has one main, labelled nav, one h1', landmarks.main === 1 && landmarks.nav === 1 && landmarks.h1 === 1, JSON.stringify(landmarks));

// Reduced motion support exists in CSS
const css = await page.evaluate(async () => (await fetch('./assets/css/styles.css')).text());
check('Respects prefers-reduced-motion', css.includes('prefers-reduced-motion'));
check('Focus styles defined', css.includes(':focus-visible'));

// iOS viewport meta & safe area
const meta = await page.getAttribute('meta[name="viewport"]', 'content');
check('Viewport meta includes viewport-fit=cover', meta.includes('viewport-fit=cover'), meta);
check('Safe-area insets used in layout', css.includes('env(safe-area-inset-bottom)'));

// Tap target sizes on tab bar
await page.evaluate(() => { location.hash = '#/overview'; });
await page.waitForTimeout(350);
const tabRects = await page.evaluate(() => [...document.querySelectorAll('.tab')].map((t) => {
  const r = t.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
}));
check('Tab bar targets at least 44px tall', tabRects.every((r) => r.h >= 44), JSON.stringify(tabRects));

check('No page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(results.join('\n'));
