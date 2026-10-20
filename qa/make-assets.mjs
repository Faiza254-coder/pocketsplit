import pw from '/opt/playwright/node_modules/playwright/index.js';
const { chromium } = pw;
import { mkdir, writeFile } from 'node:fs/promises';

const out = '/home/user/pocketsplit/assets/icons';
await mkdir(out, { recursive: true });

function markGroup(size, { square = true } = {}) {
  const s = size / 64;
  const leaf = `<path d="M40.5 12.5c7.4-2.9 13 2.7 10.1 10.1-7.4 2.9-13-2.7-10.1-10.1Z" fill="#A9C5A6"/>
    <path d="M41.8 14.2c1.7 2.6 3.7 4.7 6.3 6.3" stroke="#123B2A" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
  return `<g transform="scale(${s})">
    ${square ? '<rect x="1" y="1" width="62" height="62" rx="19" fill="#123B2A"></rect>' : ''}
    <path d="M32 15v34M15 32h34" stroke="#F8F2E4" stroke-width="9.5" stroke-linecap="round"></path>
    ${leaf}
  </g>`;
}

function appIcon(size, { maskable = false } = {}) {
  const pad = maskable ? size * 0.2 : size * 0.16;
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1B4E37"/>
        <stop offset="1" stop-color="#0D2C1F"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.42" r="0.55">
        <stop offset="0" stop-color="#3D7A56" stop-opacity="0.45"/>
        <stop offset="1" stop-color="#3D7A56" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/>
    <rect width="${size}" height="${size}" fill="url(#glow)"/>
    <g transform="translate(${pad} ${pad})">
      ${markGroup(inner, { square: false })}
    </g>
  </svg>`;
}

function splash(width, height) {
  const mark = Math.round(Math.min(width * 0.34, 260));
  const x = (width - mark) / 2;
  const y = height * 0.42;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#F6F1E7"/>
    <circle cx="${width * 0.92}" cy="${height * 0.08}" r="${width * 0.52}" fill="none" stroke="#E9E0CF" stroke-width="1.5"/>
    <circle cx="${width * 0.92}" cy="${height * 0.08}" r="${width * 0.40}" fill="none" stroke="#EDE5D5" stroke-width="1.5"/>
    <circle cx="${width * 0.06}" cy="${height * 0.94}" r="${width * 0.30}" fill="#EFE7D7" opacity="0.7"/>
    <g transform="translate(${x} ${y})">
      <g filter="url(#soft)">
        ${markGroup(mark, { square: true })}
      </g>
    </g>
    <rect x="${width / 2 - 22}" y="${y + mark + 48}" width="44" height="4" rx="2" fill="#C9A85C" opacity="0.8"/>
    <defs>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#123B2A" flood-opacity="0.16"/>
      </filter>
    </defs>
  </svg>`;
}

const browser = await chromium.launch();

async function renderSvg(svg, width, height, file, { transparent = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`);
  await page.screenshot({ path: `${out}/${file}`, omitBackground: transparent, clip: { x: 0, y: 0, width, height } });
  await page.close();
}

await renderSvg(appIcon(192), 192, 192, 'icon-192.png');
await renderSvg(appIcon(512), 512, 512, 'icon-512.png');
await renderSvg(appIcon(512, { maskable: true }), 512, 512, 'maskable-512.png');
await renderSvg(appIcon(1024), 1024, 1024, 'icon-1024.png');
await renderSvg(appIcon(180), 180, 180, 'apple-touch-icon-180.png');
await renderSvg(appIcon(152), 152, 152, 'apple-touch-icon-152.png');
await renderSvg(appIcon(167), 167, 167, 'apple-touch-icon-167.png');

const splashes = [
  [828, 1792, 'splash-828x1792.png'],
  [1125, 2436, 'splash-1125x2436.png'],
  [1170, 2532, 'splash-1170x2532.png'],
  [1284, 2778, 'splash-1284x2778.png'],
  [750, 1334, 'splash-750x1334.png'],
  [1242, 2688, 'splash-1242x2688.png']
];
for (const [w, h, name] of splashes) {
  await renderSvg(splash(w, h), w, h, name);
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="1" y="1" width="62" height="62" rx="16" fill="#123B2A"/>
  <path d="M32 15v34M15 32h34" stroke="#F8F2E4" stroke-width="9.5" stroke-linecap="round"/>
  <path d="M40.5 12.5c7.4-2.9 13 2.7 10.1 10.1-7.4 2.9-13-2.7-10.1-10.1Z" fill="#A9C5A6"/>
  <path d="M41.8 14.2c1.7 2.6 3.7 4.7 6.3 6.3" stroke="#123B2A" stroke-width="1.4" stroke-linecap="round" fill="none"/>
</svg>`;
await writeFile(`${out}/favicon.svg`, favicon);

await browser.close();
console.log('assets written');
