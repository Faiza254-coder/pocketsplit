# PocketSplit — Offline Shop & Home Expense Tracker

PocketSplit is a private expense diary for a pharmacy owner. It records **money spent**, not sales.
It runs as a **Progressive Web App (PWA)**: plain HTML, CSS and JavaScript, no build step, no
account, no cloud, no subscription, no Apple Developer account.

All records are stored in **IndexedDB on the device**. Nothing financial is ever uploaded.

---

## 1. What it does

| Area | What you get |
|---|---|
| **Shop** | Salaries, advances, additional worker payments, workers' lunch, bills, rent, supplies, any custom description |
| **Home** | Groceries, chicken, beef, mutton, clothes, gas/electricity bills, household supplies, any custom description |
| **Workers** | Add / rename workers, record Salary, Advance, Additional Payment and Repayment, view per-worker ledgers with date ranges |
| **History** | Search by description, worker or note; filter by pocket and date range; edit and delete with confirmation |
| **Reports** | Today, monthly and custom ranges; Shop vs Home totals; daily/monthly bars; spending by description; worker-wise totals |
| **Backup** | Full JSON export with checksum, validated import, merge or replace, duplicate protection |
| **Dashboard** | Live month filter, total spending, Shop/Home summaries, recent transactions, quick actions |

Deliberately **not** included: sales, inventory, customers, profit calculations, double-entry
bookkeeping, cloud sync, user accounts, analytics.

---

## 2. Technology (and why)

| Choice | Reason |
|---|---|
| Plain HTML + CSS + ES modules | Nothing to install or compile. A beginner can edit one file and refresh. |
| IndexedDB | Stores thousands of records far more safely than `localStorage`, and works offline. |
| Hand-written service worker | Caches the app shell so PocketSplit opens with no internet. |
| Web App Manifest + Apple meta tags | Makes it installable from Safari with its own icon and splash screen. |
| No framework, no bundler | Saves money, disk space and confusion. There is no `npm install` to break later. |

**What you need on Windows 10:** a browser (Chrome/Edge) to test locally, **VS Code** to edit,
and a free **GitHub** account for HTTPS hosting. Nothing else. No Node.js is required to *run*
the app; it is only handy for an optional local server and the test scripts.

---

## 3. Project structure

```
pocketsplit/
├─ index.html                  App entry, meta tags, inline SVG icon sprite
├─ manifest.webmanifest        PWA name, icons, colours, standalone display
├─ sw.js                       Service worker: offline cache of app files
├─ README.md                   This file
├─ assets/
│  ├─ css/
│  │  └─ styles.css            All styling (design tokens at the top)
│  ├─ js/
│  │  ├─ app.js                Shell, router, boot, error screens
│  │  ├─ utils.js              Money (integer paisa), dates, filters, formatting
│  │  ├─ db.js                 IndexedDB layer (transactions, workers, meta)
│  │  ├─ components.js         Buttons, sheets, dialogs, rows, month picker
│  │  ├─ backup.js             Backup format, validation, checksum
│  │  ├─ updates.js            Service-worker registration and update prompt
│  │  └─ views/
│  │     ├─ dashboard.js       Overview screen
│  │     ├─ expenses.js        Shop/Home feeds, history, add/edit form
│  │     ├─ workers.js         Worker list, editor, worker ledger
│  │     ├─ reports.js         Reports
│  │     ├─ backup.js          Backup & restore screen
│  │     └─ more.js            About, help, install steps
│  └─ icons/                   App icons + iPhone splash screens (PNG + SVG)
└─ tools/                      Optional helper scripts
   ├─ run-local-server.bat     Opens the app in a browser on Windows
   └─ test/                    Automated browser tests (optional, needs Playwright)
```

Everything is plain text you can inspect. There is no hidden build step, and no code is generated
when you "compile" the app.

---

## 4. Open the project in VS Code (Windows 10)

1. Copy the `pocketsplit` folder to somewhere like `C:\Projects\pocketsplit`.
2. Install **Visual Studio Code** (free): <https://code.visualstudio.com>
3. In VS Code: **File → Open Folder…** → choose `C:\Projects\pocketsplit`.
4. Recommended free extensions (optional): *Live Server* (Ritwick Dey) and *HTML CSS Support*.
5. To preview: double-click `tools\run-local-server.bat`, then open
   <http://localhost:8000> in Chrome or Edge. (Opening `index.html` directly also mostly works,
   but a service worker and install prompt need `http://`.)

> Recommended browser for testing the layout: Chrome or Edge → press **F12** → click the
> device toolbar → choose **iPhone 11** (414 × 896).

---

## 5. Where to host it — free, HTTPS, no card

PWAs need **HTTPS** (or `localhost`) for the service worker and installation. A free
**GitHub Pages** site gives you `https://<username>.github.io/<repo>/` at no cost.

**Important, verified on GitHub's own docs:** on a **GitHub Free personal account, a Pages site
must come from a *public* repository.** Private-repository Pages needs GitHub Pro or higher.
That is fine here:

- The repository contains **only the app code** — never the client's data.
- The client's records live in his iPhone's storage and in the JSON files he chooses to save.
- A public repo does **not** make his records public.

Steps:

1. Create a free GitHub account.
2. Create a **public** repository, e.g. `pocketsplit`.
3. Upload the contents of this folder (or `git init` / `git add .` / commit / push).
4. Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch →
   Branch: `main` → Folder: `/ (root)` → Save**.
5. Wait a minute, then open `https://<username>.github.io/pocketsplit/`.
6. On the iPhone: open that address **in Safari** → Share → **Add to Home Screen**.

### Other zero-cost options
- **Cloudflare Pages / Netlify / Vercel free tiers** — also fine (public by default, HTTPS,
  free custom subdomain). No card needed on the free tier at time of writing, but their terms
  can change; GitHub Pages with a public repo is the simplest documented free path.
- **Local-only install** — no hosting at all is possible only by copying files onto the phone
  and serving them somehow; iOS will not install a PWA from `file://`. For a real installation,
  HTTPS hosting is required. This is a genuine limitation, stated plainly.

---

## 6. Install on the iPhone 11

1. Connect the iPhone to the internet (Wi-Fi or mobile data) **once**.
2. Open Safari and go to the GitHub Pages address.
3. Tap the **Share** button (square with an arrow).
4. Scroll and tap **Add to Home Screen**. On iOS 26+ leave **Open as Web App** switched on.
5. Tap **Add**. From now on, open PocketSplit from its own icon.
6. Open the app once more while online so the service worker finishes caching every file.
7. Optional: test airplane mode — the app should still open and save expenses.

**Use the icon, not a Safari tab.** On iPhone a Home Screen web app has **its own storage**,
separate from Safari (confirmed by Apple/WebKit). Data entered in a Safari tab will not appear
inside the installed icon, and vice versa. If you ever switch, move data with a backup file.

---

## 7. Backup & restore

- **Export:** Backup → *Save or share backup* (uses the iPhone share sheet, e.g. *Save to Files*
  or iCloud Drive) or *Download backup file*.
- The file is named `PocketSplit-backup-YYYY-MM-DD-HHMM.json`.
- **Contents:** every transaction (ID, section, direction, description, amount, date, time,
  note, worker link, payment type, timestamps), worker records, a summary and a checksum.
- **Import:** Backup → *Choose backup file*. PocketSplit validates the file, previews its totals,
  then asks for **Merge** (adds new records, skips IDs already present) or **Replace** (deletes
  current records first, behind a confirmation).
- **Rejected files:** non-PocketSplit files, truncated JSON, failed checksum, missing worker
  references, duplicate IDs, impossible dates, unsupported formats. Nothing is written to the
  database when validation fails — restores run in a single atomic IndexedDB transaction.

To move a backup **off** the iPhone: share it to *Files* or *iCloud Drive*, then AirDrop, email,
WhatsApp (as a document) or iCloud Drive to the PC. This is a manual transfer, **not** automatic
cloud sync.

---

## 8. Which steps need the internet?

| Step | Internet needed? |
|---|---|
| Editing files in VS Code | No |
| Previewing on Windows (localhost) | No |
| First install on iPhone (Safari → Add to Home Screen) | **Yes** |
| Opening and using PocketSplit after install | **No** |
| Adding/editing/deleting records, reports, worker ledgers | **No** |
| Backup export/restore | **No** (the file goes wherever you choose) |
| Receiving app updates | Yes (only when you publish a new version) |

Airplane mode is the simplest offline test: turn it on, force-quit the app, reopen it.

---

## 9. How offline works

`sw.js` downloads the app shell into Cache Storage on first load. On later launches:

- **Navigations** try the network, then fall back to the cached shell.
- **Static files** are served cache-first and refreshed in the background.
- The **database is local**, so records never depend on a connection.

When you change any file, bump `CACHE_VERSION` in `sw.js` (for example `pocketsplit-v1.0.1`).
The new service worker installs in the background, and the app shows an **Update** toast.

---

## 10. Data model

```
transactions (keyPath: id)
  id, section ("shop" | "home"), direction ("out" | "in"),
  description, amount (number, PKR), date ("YYYY-MM-DD"), time ("HH:MM"),
  category?, note?, workerId?, workerName?, paymentType?,
  createdAt, updatedAt
  indexes: by-date, by-section, by-worker

workers (keyPath: id)
  id, name, nameLower, createdAt, updatedAt

meta (keyPath: key)
  installedAt, schemaVersion, lastBackupAt, lastRestoreAt, ...
```

**Accounting rules enforced in code**

- Money is stored as decimals but **summed in integer paisa**, so `0.10 + 0.20` is exactly `0.30`
  and never `0.30000000000000004`.
- Shop totals include **only** `section === "shop"` and `direction !== "in"`.
- Home totals include **only** `section === "home"` and `direction !== "in"`.
- A **Repayment** (`direction === "in"`) reduces a worker's *net paid* and is never counted as
  spending. An **Advance** is a normal outgoing payment — not assumed to be a loan.
- Deleting a worker is blocked while linked payments exist, so worker totals cannot silently
  lose records.
- Every total is recalculated from records on each render. Nothing is cached or hardcoded.

---

## 11. Tests

See `tools/test/` and `QA-REPORT.md`. The suite covers adding Shop/Home expenses, workers,
payments and repayments, validation, edit/delete, search/filters, reports, month navigation,
decimal precision, persistence, offline reload and saving, backup export, duplicate-safe merge,
full restore, erase, and rejection of corrupted/tampered/foreign backups.

Run them (optional, needs Node.js + Playwright):

```bat
cd tools\test
npm install
npx playwright install chromium
npx playwright test
```

---

## 12. Honest zero-budget limitations

- **GitHub Free requires a public repository for Pages.** The code is public; the client's data
  never is. Private hosting would need a paid plan.
- **iOS storage is controlled by Apple.** A Home Screen app is exempt from Safari's 7-day
  storage deletion, but deleting the app, clearing website data, or losing the phone still
  erases records. Backups are the only protection.
- **Safari and the Home Screen app do not share storage.** Pick one and stay with it.
- **No background sync.** There is nothing to sync, because there is no server.
- **`navigator.share` file support varies.** PocketSplit offers a download fallback and only
  claims success once the browser accepts the file — it cannot verify where you saved it.
- **No App Store listing.** That would need a paid Apple Developer account; it is not required
  to use or install this app.
- **Updates are manual.** You publish a new `CACHE_VERSION`; the client taps *Update*.
- **Not an accounting system.** No VAT/tax reporting, receipts, reconciliation or audit trail.

---

## 13. Updating the app later

1. Edit the files.
2. Change `CACHE_VERSION` in `sw.js`.
3. Commit and push to GitHub.
4. On the iPhone, open the app (online) and accept the **Update** toast.

Records are untouched by updates.

---

## 14. Credits

Design, front end, database layer, QA and documentation built for this project.
No paid libraries, fonts, services or assets. Icons are inline SVG drawn for this app.
