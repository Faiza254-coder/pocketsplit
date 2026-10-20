import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
import fs from 'node:fs/promises';

const BASE = 'http://127.0.0.1:8080/';
const shots = '/home/user/qa/shots';
await fs.mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
const page = await context.newPage();
const problems = [];
page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`[${msg.type()}] ${msg.text()}`); });
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) => problems.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ready="true"]', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/01-dashboard-empty.png`, fullPage: true });

const bodyText = await page.locator('body').innerText();
console.log('--- DASHBOARD TEXT ---');
console.log(bodyText.slice(0, 1200));
console.log('--- PROBLEMS ---');
console.log(problems.length ? problems.join('\n') : 'none');

await browser.close();
