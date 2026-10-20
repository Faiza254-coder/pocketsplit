# PocketSplit — QA Report

**Version tested:** 1.0.0
**Date:** 20 October 2026
**Build tested:** the exact files in this folder / ZIP

---

## 1. What was verified, and how

Automated browser tests were run against the real application (not mockups) using headless
Chromium at **iPhone 11 (414 × 896)** and **iPhone SE (375 × 667)** viewports, plus a
**GitHub-Pages-style sub-path** deployment (`/pocketsplit/`). Every check below queries the
rendered UI and the real IndexedDB database.

Two suites exist:

1. **Developer suite** — `tools/test/` (Playwright). Run with:
   ```bat
   cd tools\test
   npm install
   npx playwright install chromium
   npm test
   ```
   Result: **22/22 passed** (11 tests × 2 iPhone viewport projects).

2. **Extended QA suite** — the deeper scenarios recorded in section 3 (77 checks). These are
   reproducible with the steps in section 5.

---

## 2. Feature status matrix

| Area | Status | Notes |
|---|---|---|
| Add Shop expense | ✅ Tested | Short workflow: amount → description → save. Date/time automatic. |
| Add Home expense | ✅ Tested | Same flow, separate pocket. |
| Automatic date & time | ✅ Tested | Local device time; editable for older bills. |
| Edit expense | ✅ Tested | Totals and worker history update immediately. |
| Delete expense | ✅ Tested | Confirmation dialog with record details. |
| Amount validation | ✅ Tested | Rejects letters, negatives, zero, >2 decimals, exponent notation, >PKR 999,999,999.99. Accepts `1,250`. |
| Decimal accuracy | ✅ Tested | Sums in integer paisa: 0.10 + 0.20 = 0.30 exactly. |
| Future date rejected | ✅ Tested | |
| Duplicate entry warning | ✅ Tested | Identical description + amount + date + time asks before saving. |
| Workers: add / rename | ✅ Tested | Case-insensitive duplicate names rejected. |
| Worker delete protection | ✅ Tested | Blocked while payment records exist. |
| Worker payment types | ✅ Tested | Salary, Advance, Additional Payment, Repayment. |
| Repayments excluded from spending | ✅ Tested | Reduce net paid only. |
| Worker ledger + date ranges | ✅ Tested | This month / Last month / All time / Custom. |
| Search (description, worker, note) | ✅ Tested | |
| Filter by pocket + date range | ✅ Tested | All / Shop / Home; presets and custom dates. |
| Dashboard month filter | ✅ Tested | Arrows, picker sheet, current-month cap. |
| Reports: today / month / custom | ✅ Tested | Combined = Shop + Home verified. |
| Daily & monthly charts | ✅ Tested | Bars scale to the period maximum; peak day reported. |
| Spending by description | ✅ Tested | Aggregated and ranked. |
| Worker-wise report totals | ✅ Tested | Links through to the worker ledger with the same date range. |
| Persistence after reload | ✅ Tested | |
| Offline reload | ✅ Tested | Service worker serves the shell; verified with the browser network stack offline. |
| Saving while offline | ✅ Tested | Record present after reconnect + reload. |
| Sub-path (GitHub Pages) install | ✅ Tested | Service worker scope, manifest, icons, offline reload. |
| Backup export (download) | ✅ Tested | Correct filename, envelope, checksum, summary. |
| Backup via share sheet | ⚠️ Requires device | `navigator.share` needs a real iOS/desktop share target. Download fallback tested. |
| Duplicate-safe merge | ✅ Tested | Re-importing the same file adds 0 records. |
| Full restore after erase | ✅ Tested | Exact totals and worker count reproduced. |
| Corrupted JSON rejected | ✅ Tested | Truncated file rejected, existing data untouched. |
| Tampered amount rejected | ✅ Tested | Checksum mismatch explained. |
| Broken worker link rejected | ✅ Tested | Import refused rather than corrupting worker totals. |
| Foreign / newer-format file | ✅ Tested | Rejected with guidance. |
| Erase all data | ✅ Tested | Requires confirmation; totals return to zero. |
| Accessibility basics | ✅ Tested | Focus trap, Escape handling, accessible names, 44–50 px tab targets, reduced-motion support, safe-area insets. |
| Layout, no horizontal scroll | ✅ Tested | 414 px and 375 px, every screen. |
| Text contrast | ✅ Measured | Body/labels ≥ 4.5:1 on cream and surface backgrounds. |
| Splash screens / icons | ✅ Rendered | Generated PNGs at required sizes. |
| **Physical iPhone installation** | ⚠️ Not tested here | Requires a real device + HTTPS host. Instructions provided. |
| **iOS Safari rendering** | ⚠️ Not tested here | Chromium was used. Safari-specific checks listed in section 6. |

---

## 3. Detailed results (77 automated checks)

### Core flows — 28 checks
- Shop expense saves and the section total shows `PKR 12,500`.
- Home expense saves and shows `PKR 5,800`.
- Dashboard hero total `PKR 20,700.50` after three mixed records.
- Worker creation ×2; duplicate name `ali raza` correctly rejected.
- Salary 25,000 + Advance 5,000 + Repayment 2,000 + Salary 18,000 + Lunch 1,500
  → Shop total **62,000** (repayment excluded), worker-paid 48,000, repaid 2,000.
- Worker card reads “2 payments · 1 repaid”.
- Ledger shows Paid 30,000 / Repaid 2,000 / Net 28,000.
- History shows 8 records (7 expenses + 1 repayment).
- Edit prefilled `12500` → changed to `13000` → Shop total 62,500.
- Delete dialog names the record and amount; confirming updates the dashboard to 68,300.
- Invalid amount, empty description, negative value, future date all blocked with field errors.
- Search “salary” → 2 rows, total 43,000, lunch excluded.
- Home filter → 1 row; date filter → “Today”.
- Report total 68,300 = 62,500 + 5,800; both workers listed.
- Reload → 68,300 preserved.

### Backup & restore — 23 checks
- Export filename `PocketSplit-backup-2026-10-20-0607.json`; envelope `app/format/currency` correct.
- 5 transactions, 2 workers, checksum `fnv1a:…`, summary total 37,300.75.
- All worker links resolve.
- Success message only appears after the browser accepts the file.
- Re-import: “0 transactions and 0 workers added. 5 duplicate transaction records were skipped.”
- Truncated file → “not valid JSON”.
- Edited amount → “failed its integrity check”.
- Missing worker reference → refused.
- Non-PocketSplit file → “not a PocketSplit backup”.
- `format: 99` → “created by a newer version”.
- Erase → 0. Restore → exactly 37,300.75, 2 workers.
- Service worker registered; offline reload; offline save → 38,077.75; survives reconnect.

### Edge cases — 17 checks
- Precision: 0.10 + 0.20 + 100.05 = **100.35** exactly.
- `10.555` → “at most two decimal places”; `1e5` → rejected; `1,250` → accepted.
- Month navigation forward/back, current month capped, empty month state.
- Worker quick-payment link preselects worker + “Advance”; saving returns to the ledger.
- Worker rename updates header **and** the name stored on linked payments.
- Search by worker name works.
- Today report 4,350.35; custom range label “1 Oct – 5 Oct 2026”.
- Shop 3,099 / Home 1,350.35 — pockets never mix.

### Sub-path deployment — 8 checks
- SW scope `…/pocketsplit/`; manifest `start_url: "./"`; all icons 200.
- Expense saves; offline reload ready; every control has an accessible name; no console errors.

### Accessibility & layout — 13 checks
- Sheet and dialog open/close from keyboard, Escape works, focus lands inside the dialog.
- Cancelling a delete keeps the form and data unchanged.
- One `<main>`, one labelled `<nav>`, one `<h1>` per screen.
- `prefers-reduced-motion` honoured; `:focus-visible` styles present; `viewport-fit=cover`.
- Tab targets 78 × 50 px; no horizontal overflow at 375 or 414 px.

---

## 4. Bugs found during QA, and fixes

| # | Issue found | Fix |
|---|---|---|
| 1 | App icon rendered the plus in dark-on-dark | Rebuilt the icon vector with cream strokes; verified visually |
| 2 | Toasts used dark green panels; small light text was hard to read | Switched toasts to a light surface with dark text and a tinted icon |
| 3 | Summary card label ran into the amount (`Shop spendingPKR 96,000`) | Made the label/amount/foot span blocks |
| 4 | “(optional)” wrapped onto its own line inside option cards | Inline flex label row |
| 5 | Chart axis left/right labels bunched together | Three-column grid axis |
| 6 | `--muted-2` text was 3.37:1 (below AA for small text) | Darkened to `#65705f` (≈5:1) |
| 7 | Worker card hid repayments from the payment count | Count now shows “2 payments · 1 repaid” |
| 8 | “1 payment records” grammar in the worker editor | Singular/plural verb |
| 9 | Worker rename did not refresh the worker-name snapshot on existing payments | Rename now updates linked transactions in the same transaction |
| 10 | Report worker rows opened the ledger without the report’s date range | Rows pass the exact range through |
| 11 | Sub-path offline reload appeared to stall in one scripted test | Traced to a test timing assumption; re-verified all 8 routes boot offline from `/pocketsplit/` |
| 12 | No guard against accidental double entry | Added a “Possible duplicate” confirmation |

---

## 5. Reproduce the manual test (10 minutes)

Serve the folder (`tools\run-local-server.bat`, then open `http://localhost:8000`), or use the
hosted GitHub Pages URL.

1. **Shop:** Add expense → `12500` → `Electricity bill` → Save → Shop shows PKR 12,500.
2. **Home:** Add expense → Home tab → `5800` → `Groceries` → Save → Home shows PKR 5,800.
3. **Workers:** Shop → Workers → Add worker → `Ali Raza`. Open the worker → Record a payment →
   `25000` → Salary → Save.
4. **Alternative payment:** Worker → quick chip **Advance** → `5000` → Save.
5. **Repayment:** Worker → quick chip **Repayment** → `2000` → Save. Shop total must **not** rise;
   net paid must drop by 2,000.
6. **Edit:** All transactions → tap Electricity bill → change to `13000` → Save → totals update.
7. **Delete:** tap Groceries → bin → confirm → Home total updates; cancel a delete once first and
   verify nothing changed.
8. **Automatic date:** Add expense → today’s date/time is prefilled; change it to last week and save;
   the entry appears under that date.
9. **Search/filter:** All transactions → type `salary`; then filter Shop / Today.
10. **Reports:** Reports → Month → verify Shop + Home = Recorded spending; switch to Custom dates.
11. **Persistence:** close the tab/browser, reopen → all figures unchanged.
12. **Offline:** open all five tabs once online → airplane mode → reopen → app works; add an
    expense; turn the network back on → record still present.
13. **Backup:** Backup → Download backup file → open the JSON and confirm the record count.
    Import the same file → “0 added, N duplicates skipped”. Import a text file → rejected.
14. **Layout:** DevTools → device toolbar → iPhone 11 and iPhone SE → no horizontal scrolling.

---

## 6. Still requires testing on the physical iPhone 11

These cannot be proven in this environment and must be checked on the device:

1. **Safari rendering** — font smoothing, dynamic toolbar behaviour, safe-area spacing under the
   notch, and the Home Screen standalone launch (no Safari UI).
2. **Add to Home Screen** — icon, name and splash screen appearance; “Open as Web App” behaviour.
3. **Share-sheet export** — that *Save to Files* / *iCloud Drive* appears and produces a valid file.
4. **File picker import** — selecting a backup from *Files* on iOS.
5. **Storage separation** — confirming that a record created in Safari does not appear in the
   installed icon (expected Apple behaviour), and that backups move data correctly.
6. **Long-run persistence** — several days of normal use, and iOS storage behaviour under pressure.
7. **VoiceOver** — spoken labels on the form and tab bar.
8. **Real offline switch** — Airplane Mode toggling with the installed app already open.

Recommended device check: follow section 5 on the iPhone itself, then export a backup and confirm
the file is visible in *Files*.
