/*
 * Dashboard / Overview.
 * Every number on this screen is calculated from locally stored transactions.
 */

import {
  currentMonthKey, formatDate, formatPKR, formatPercent, isIOS, isStandalone,
  monthLabel, monthRange, percent, pluralize, shiftMonth, todayISO,
  validMonthKey, filterTransactions, totals, escapeHTML
} from '../utils.js';
import {
  brandLockup, icon, iconButton, monthSwitcher, openMonthPicker,
  transactionRow
} from '../components.js';
import { getAllTransactions, getAllWorkers, getAllMeta } from '../db.js';

function syncMonthToHash(monthKey) {
  const nextHash = `#/overview?m=${monthKey}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }
}

function comparisonText(currentTotal, previousTotal, previousMonth) {
  if (currentTotal <= 0 && previousTotal <= 0) {
    return { text: 'Nothing recorded yet for this month.', tone: 'neutral' };
  }
  if (previousTotal <= 0) {
    return { text: `No spending recorded in ${monthLabel(previousMonth, 'short')}.`, tone: 'neutral' };
  }
  const change = ((currentTotal - previousTotal) / previousTotal) * 100;
  const rounded = Math.abs(Math.round(change));
  if (rounded === 0) return { text: `About the same as ${monthLabel(previousMonth, 'short')}.`, tone: 'neutral' };
  return {
    text: `${rounded}% ${change > 0 ? 'more' : 'less'} than ${monthLabel(previousMonth, 'short')}`,
    tone: change > 0 ? 'up' : 'down'
  };
}

function backupNudge(meta, transactionCount) {
  if (!transactionCount) return '';
  const last = meta && meta.lastBackupAt ? Date.parse(meta.lastBackupAt) : null;
  if (last) {
    const days = Math.floor((Date.now() - last) / 86400000);
    if (days < 21) return '';
    return `<a class="backup-nudge" href="#/backup">
      <span class="nudge-icon">${icon('shield', 17)}</span>
      <span>
        <strong>Your last backup was ${days} days ago</strong>
        <span>A quick export keeps your records safe.</span>
      </span>
      ${icon('chevron-right', 16, 'chev')}
    </a>`;
  }
  return `<a class="backup-nudge" href="#/backup">
    <span class="nudge-icon">${icon('shield', 17)}</span>
    <span>
      <strong>No backup yet</strong>
      <span>Export a copy so your records survive a lost phone.</span>
    </span>
    ${icon('chevron-right', 16, 'chev')}
  </a>`;
}

function recentRows(transactions) {
  if (!transactions.length) return '';
  return `<div class="recent-card card">
    ${transactions.slice(0, 6).map((tx) => transactionRow(tx, {
      showSection: true,
      from: 'overview'
    })).join('')}
  </div>`;
}

function summaryCard(section, total, count, extra) {
  const isShop = section === 'shop';
  return `<a class="summary-card ${section}" href="#/${section}">
    <span class="summary-top">
      <span class="summary-icon">${icon(isShop ? 'store' : 'home', 17)}</span>
      ${icon('chevron-right', 15, 'summary-chev')}
    </span>
    <span>
      <span class="summary-label">${isShop ? 'Shop spending' : 'Home spending'}</span>
      <span class="summary-amount">${escapeHTML(formatPKR(total))}</span>
      <span class="summary-foot">${count === 0 ? 'No entries yet' : `${pluralize(count, 'entry', 'entries')}${extra ? ` · ${extra}` : ''}`}</span>
    </span>
  </a>`;
}

function onboardingCard(hasWorkers) {
  return `<div class="onboarding-card">
    <p class="onboarding-title">Two pockets, one diary</p>
    <p class="onboarding-text">Record what you pay in seconds. Use Shop for salaries, bills and stock; use Home for groceries and household costs.${hasWorkers ? '' : ' Add your workers once, then tag their salary or advance as you pay it.'}</p>
    <div class="pocket-rows">
      <a class="pocket-row" href="#/add?section=shop">
        <span class="pocket-icon shop">${icon('store', 16)}</span>
        <span>
          <strong>Record a shop expense</strong>
          <span class="small">Salary, rent, electricity, supplies…</span>
        </span>
        ${icon('chevron-right', 15, 'chev')}
      </a>
      <a class="pocket-row" href="#/add?section=home">
        <span class="pocket-icon home">${icon('home', 16)}</span>
        <span>
          <strong>Record a home expense</strong>
          <span class="small">Groceries, meat, clothes, bills…</span>
        </span>
        ${icon('chevron-right', 15, 'chev')}
      </a>
    </div>
  </div>`;
}

const INSTALL_HINT_KEY = 'pocketsplit.installHintDismissed';

function installHintMarkup() {
  if (isStandalone() || !isIOS()) return '';
  let dismissed = false;
  try { dismissed = window.localStorage.getItem(INSTALL_HINT_KEY) === '1'; } catch (error) { dismissed = false; }
  if (dismissed) return '';
  return `<div class="install-hint" id="install-hint" role="note">
    ${icon('phone', 16)}
    <span>
      <strong>Use PocketSplit like a real app.</strong> In Safari tap Share → “Add to Home Screen”.
      The Home Screen icon has its own storage, so enter records there from then on.
    </span>
    <button class="icon-btn icon-btn-plain icon-btn-sm" type="button" id="dismiss-install-hint" aria-label="Dismiss installation tip">${icon('x', 15)}</button>
  </div>`;
}

async function render(root, monthKey) {
  const [allTransactions, workers, meta] = await Promise.all([
    getAllTransactions(),
    getAllWorkers(),
    getAllMeta()
  ]);

  const month = validMonthKey(monthKey) ? monthKey : currentMonthKey();
  const { start, end } = monthRange(month);
  const previousMonth = shiftMonth(month, -1);
  const previousMonthRange = monthRange(previousMonth);

  const monthTransactions = filterTransactions(allTransactions, { start, end });
  const monthTotals = totals(monthTransactions);
  const previousTotals = totals(filterTransactions(allTransactions, {
    start: previousMonthRange.start,
    end: previousMonthRange.end
  }));

  const comparison = comparisonText(monthTotals.total, previousTotals.total, previousMonth);
  const recent = allTransactions.slice(0, 6);
  const hasAnyRecords = allTransactions.length > 0;
  const expenseCount = monthTotals.shopCount + monthTotals.homeCount;
  const shopWidth = monthTotals.total > 0 ? percent(monthTotals.shop, monthTotals.total) : 0;
  const homeWidth = monthTotals.total > 0 ? percent(monthTotals.home, monthTotals.total) : 0;
  const isCurrentMonth = month >= currentMonthKey();

  root.innerHTML = `
    <header class="home-head">
      <div class="brand-row">
        ${brandLockup()}
        <div class="brand-row-actions">
          ${iconButton({ icon: 'backup', label: 'Backup and restore', href: '#/backup' })}
          ${iconButton({ icon: 'more', label: 'About and help', href: '#/more' })}
        </div>
      </div>
      <p class="eyebrow">${escapeHTML(formatDate(todayISO(), 'weekday'))}</p>
      <h1 class="greeting">Assalam-o-Alaikum</h1>
      <p class="page-sub">Here is where your money went in ${escapeHTML(monthLabel(month))}.</p>
    </header>

    <div class="dash-month">
      ${monthSwitcher(month, { id: 'dash-month' })}
    </div>

    <section class="hero" aria-label="Total spending for ${escapeHTML(monthLabel(month))}">
      <div class="hero-top">
        <span class="hero-label">Total spending</span>
        <span class="hero-chip">${icon('calendar', 12)}${escapeHTML(monthLabel(month, 'short'))}</span>
      </div>
      <div class="hero-amount">
        <span class="cur">PKR</span>
        <span class="num">${escapeHTML(formatPKR(monthTotals.total, { showCurrency: false }))}</span>
      </div>
      <div class="hero-meta">
        <span>${escapeHTML(pluralize(expenseCount, 'expense'))}</span>
        <span aria-hidden="true">·</span>
        <span class="${comparison.tone}">${escapeHTML(comparison.text)}</span>
      </div>
      <div class="split-bar" role="img" aria-label="${escapeHTML(`Shop ${formatPercent(monthTotals.shop, monthTotals.total)}, Home ${formatPercent(monthTotals.home, monthTotals.total)}`)}">
        <span class="split-shop" style="width:${shopWidth.toFixed(2)}%"></span>
        <span class="split-home" style="width:${homeWidth.toFixed(2)}%"></span>
      </div>
      <div class="split-legend">
        <span class="legend-item"><i class="legend-dot shop"></i>Shop <strong>${escapeHTML(formatPKR(monthTotals.shop))}</strong></span>
        <span class="legend-item"><i class="legend-dot home"></i>Home <strong>${escapeHTML(formatPKR(monthTotals.home))}</strong></span>
      </div>
    </section>

    <div class="summary-grid">
      ${summaryCard('shop', monthTotals.shop, monthTotals.shopCount, monthTotals.workerCount ? `${pluralize(monthTotals.workerCount, 'worker payment')}` : '')}
      ${summaryCard('home', monthTotals.home, monthTotals.homeCount, '')}
    </div>

    <div class="add-actions">
      <a class="btn btn-primary btn-lg btn-block" href="#/add">
        ${icon('plus', 20)}Add expense
      </a>
      <div class="quick-strip">
        <a class="quick-tile" href="#/workers">
          ${icon('users', 18)}
          <span>Workers</span>
          <span class="count-pill">${workers.length}</span>
          ${icon('chevron-right', 14, 'chev')}
        </a>
        <a class="quick-tile" href="#/backup">
          ${icon('shield', 18)}
          <span>Backup</span>
          ${icon('chevron-right', 14, 'chev')}
        </a>
      </div>
    </div>

    ${!hasAnyRecords
      ? onboardingCard(workers.length > 0)
      : (monthTotals.total === 0 ? `<div class="mt-16">
          <div class="inline-empty">
            No shop or home spending in ${escapeHTML(monthLabel(month))}.
            <div class="mt-8"><a class="text-link" href="#/add">${icon('plus', 13)} Record an expense</a></div>
          </div>
        </div>` : '')}

    ${hasAnyRecords ? `<div class="section-head">
      <div class="section-title-wrap">
        <h2 class="section-title">Recent activity</h2>
      </div>
      <a class="text-link" href="#/history">See all ${icon('chevron-right', 13)}</a>
    </div>
    ${recentRows(recent)}` : ''}

    ${backupNudge(meta, allTransactions.length)}
    ${installHintMarkup()}

    <p class="data-footnote">
      ${icon('lock', 14)}
      <span>All figures are calculated from the records saved on this iPhone. No sales, no profit claims — just your spending, counted once.</span>
    </p>
    <div class="page-end"></div>
  `;

  const switcher = root.querySelector('#dash-month');
  if (switcher) {
    const rerender = async (nextMonth) => {
      syncMonthToHash(nextMonth);
      await render(root, nextMonth);
    };

    switcher.querySelector('[data-month-prev]')?.addEventListener('click', () => {
      rerender(shiftMonth(month, -1));
    });

    switcher.querySelector('[data-month-next]')?.addEventListener('click', () => {
      const next = shiftMonth(month, 1);
      if (next <= currentMonthKey()) rerender(next);
    });

    switcher.querySelector('[data-month-open]')?.addEventListener('click', async () => {
      const chosen = await openMonthPicker(month);
      if (chosen && chosen !== month) {
        await rerender(chosen);
      }
    });
  }

  root.querySelector('#dismiss-install-hint')?.addEventListener('click', () => {
    const hint = root.querySelector('#install-hint');
    if (hint) hint.remove();
    try { window.localStorage.setItem(INSTALL_HINT_KEY, '1'); } catch (error) { /* storage may be unavailable */ }
  });

  if (!isCurrentMonth) {
    // Keep the hash in sync when arriving via an old link.
    syncMonthToHash(month);
  }
}

export async function run(root, params) {
  let month = params.get('m');
  if (!validMonthKey(month)) month = currentMonthKey();
  if (month > currentMonthKey()) month = currentMonthKey();
  syncMonthToHash(month);
  await render(root, month);
}
