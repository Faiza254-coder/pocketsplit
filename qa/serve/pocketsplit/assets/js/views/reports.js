/*
 * Reports — expenses only.
 * Combined spending always equals Shop + Home for the same date range.
 * There are no sales or profit figures anywhere in PocketSplit.
 */

import {
  currentMonthKey, dailySeries, daysBetweenISO, filterTransactions,
  formatDate, formatPKR, formatPercent, formatRange, fromPaisa,
  groupByDescription, monthLabel, monthRange, monthlySeries, percent,
  shiftMonth, todayISO, totals, validDateISO, validMonthKey, escapeHTML
} from '../utils.js';
import {
  avatar, brandLockup, icon, iconButton, monthSwitcher, openMonthPicker
} from '../components.js';
import { getAllTransactions, getAllWorkers } from '../db.js';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' }
];

function syncHash(hash) {
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }
}

function resolvePeriodState(params) {
  const period = PERIODS.some((entry) => entry.value === params.get('period'))
    ? params.get('period')
    : 'month';
  const selectedMonth = validMonthKey(params.get('m')) ? params.get('m') : currentMonthKey();
  const month = monthRange(selectedMonth);
  const start = validDateISO(params.get('start')) ? params.get('start') : month.start;
  const end = validDateISO(params.get('end')) ? params.get('end') : todayISO();

  if (period === 'today') {
    return { period, selectedMonth, start: todayISO(), end: todayISO() };
  }
  if (period === 'month') {
    return { period, selectedMonth, start: month.start, end: month.end };
  }
  return { period, selectedMonth, start: start > end ? end : start, end };
}

function periodQuery(state) {
  const query = new URLSearchParams({ period: state.period });
  if (state.period === 'month') query.set('m', state.selectedMonth);
  if (state.period === 'custom') {
    query.set('start', state.start);
    query.set('end', state.end);
  }
  return query.toString();
}

function periodLabelFor(state) {
  if (state.period === 'today') return `Today · ${formatDate(todayISO(), 'medium')}`;
  if (state.period === 'month') return monthLabel(state.selectedMonth);
  return formatRange(state.start, state.end);
}

function profileWorkerName(worker) {
  return worker ? worker.name : 'Worker';
}

function buildSeries(filtered, state) {
  const spanDays = daysBetweenISO(state.start, state.end) + 1;
  const monthly = spanDays > 45;
  return {
    monthly,
    items: monthly
      ? monthlySeries(filtered, state.start, state.end)
      : dailySeries(filtered, state.start, state.end),
    spanDays
  };
}

function chartMarkup(series, { monthly }) {
  const maxPaisa = Math.max(...series.map((item) => item.shopPaisa + item.homePaisa), 0);
  if (maxPaisa === 0) {
    return `<p class="inline-empty">No spending recorded in this period yet.</p>`;
  }
  const max = maxPaisa;
  const bars = series.map((item) => {
    const homePercent = (item.homePaisa / max) * 100;
    const shopPercent = (item.shopPaisa / max) * 100;
    const label = monthly ? item.label : formatDate(item.key, 'short');
    return `<div class="bar-col" title="${escapeHTML(`${label}: ${formatPKR(item.total)}`)}">
      <span class="bar home" style="height:${homePercent.toFixed(2)}%"></span>
      <span class="bar shop" style="height:${shopPercent.toFixed(2)}%"></span>
    </div>`;
  }).join('');

  const first = series[0];
  const last = series[series.length - 1];
  const mid = series[Math.floor((series.length - 1) / 2)];
  const axis = series.length > 2
    ? `<div class="chart-axis"><span>${escapeHTML(monthly ? first.label : formatDate(first.key, 'short'))}</span><span>${escapeHTML(monthly ? mid.label : formatDate(mid.key, 'short'))}</span><span>${escapeHTML(monthly ? last.label : formatDate(last.key, 'short'))}</span></div>`
    : `<div class="chart-axis"><span>${escapeHTML(monthly ? first.label : formatDate(first.key, 'short'))}</span><span>${escapeHTML(monthly ? last.label : formatDate(last.key, 'short'))}</span></div>`;

  const peak = series.reduce((best, item) => (item.total > best.total ? item : best), series[0]);
  const activeDays = series.filter((item) => item.total > 0).length;

  return `<div class="chart-wrap">
    <div class="bar-chart" role="img" aria-label="${escapeHTML(`Spending by ${monthly ? 'month' : 'day'}. Peak ${formatPKR(peak.total)}.`)}">${bars}</div>
    ${axis}
    <div class="chart-legend">
      <span><i class="shop"></i>Shop</span>
      <span><i class="home"></i>Home</span>
    </div>
    <p class="chart-summary">Peak ${monthly ? 'month' : 'day'}: ${escapeHTML(monthly ? peak.label : formatDate(peak.key, 'medium'))} · ${escapeHTML(formatPKR(peak.total))} · ${activeDays} ${monthly ? 'active months' : 'days with spending'}</p>
  </div>`;
}

function dayBreakdownMarkup(series, { monthly }) {
  const maxPaisa = Math.max(...series.map((item) => item.shopPaisa + item.homePaisa), 0);
  const active = series.filter((item) => item.total > 0);
  if (!active.length) return '<p class="inline-empty">No days with spending in this period.</p>';

  const rows = active.map((item) => {
    let start = item.key;
    let end = item.key;
    let label = formatDate(item.key, 'weekday-short');
    if (monthly) {
      const range = monthRange(item.key);
      start = range.start;
      end = range.end;
      label = item.label;
    }
    const shopPercent = maxPaisa > 0 ? (item.shopPaisa / maxPaisa) * 100 : 0;
    const homePercent = maxPaisa > 0 ? (item.homePaisa / maxPaisa) * 100 : 0;
    return `<a class="day-row" href="#/history?range=custom&start=${escapeHTML(start)}&end=${escapeHTML(end)}" aria-label="${escapeHTML(`${label}, ${formatPKR(item.total)}`)}">
      <span class="day-row-date">${escapeHTML(label)}</span>
      <span class="day-row-bars">
        <span class="day-mini-bar"><span class="shop" style="width:${shopPercent.toFixed(2)}%"></span></span>
        <span class="day-mini-bar"><span class="home" style="width:${homePercent.toFixed(2)}%"></span></span>
      </span>
      <span class="day-row-total">${escapeHTML(formatPKR(item.total))}</span>
    </a>`;
  }).join('');

  return `<div class="scroll-list"><div class="day-list">${rows}</div></div>`;
}

async function render(root, state) {
  const [allTransactions, workers] = await Promise.all([
    getAllTransactions(),
    getAllWorkers()
  ]);

  const filtered = filterTransactions(allTransactions, { start: state.start, end: state.end });
  const summary = totals(filtered);
  const todaySummary = totals(filterTransactions(allTransactions, {
    start: todayISO(), end: todayISO()
  }));
  const expenses = filtered.filter((tx) => tx.direction !== 'in');
  const seriesInfo = buildSeries(filtered, state);
  const descriptions = groupByDescription(expenses);

  const workerMap = new Map();
  workers.forEach((worker) => {
    workerMap.set(worker.id, {
      worker,
      id: worker.id,
      name: worker.name,
      paidPaisa: 0,
      repaidPaisa: 0,
      count: 0
    });
  });
  filtered.forEach((tx) => {
    if (!tx.workerId) return;
    if (!workerMap.has(tx.workerId)) {
      workerMap.set(tx.workerId, {
        worker: null,
        id: tx.workerId,
        name: tx.workerName || 'Worker',
        paidPaisa: 0,
        repaidPaisa: 0,
        count: 0
      });
    }
    const entry = workerMap.get(tx.workerId);
    if (tx.direction === 'in') entry.repaidPaisa += Math.round(tx.amount * 100);
    else {
      entry.paidPaisa += Math.round(tx.amount * 100);
      entry.count += 1;
    }
  });
  const workerRows = [...workerMap.values()]
    .filter((entry) => entry.paidPaisa > 0 || entry.repaidPaisa > 0)
    .sort((a, b) => b.paidPaisa - a.paidPaisa);

  const topDescriptions = descriptions.slice(0, 7);
  const descriptionMax = topDescriptions.length ? topDescriptions[0].paisa : 0;
  const categoryMax = descriptions.length ? descriptions[0].paisa : 0;
  const workersPaid = fromPaisa(summary.workerPaisa);
  const workersNet = fromPaisa(summary.workerPaisa - summary.inPaisa);
  const periodLabel = periodLabelFor(state);
  const monthSwitchVisible = state.period === 'month';
  const chartTitle = seriesInfo.monthly ? 'Month by month' : 'Daily pattern';
  const breakdownTitle = seriesInfo.monthly ? 'Month by month' : 'Day by day';

  root.innerHTML = `
    <div class="page-top">
      ${brandLockup()}
      <div class="page-top-actions">
        ${iconButton({ icon: 'backup', label: 'Backup and restore', href: '#/backup' })}
      </div>
    </div>

    <header class="page-heading">
      <div class="page-heading-main">
        <p class="eyebrow">Expenses only</p>
        <h1 class="page-title">Spending report</h1>
        <p class="page-sub">Shop and home costs, counted once. PocketSplit does not track sales or calculate profit.</p>
      </div>
    </header>

    <div class="segmented period-switch" id="report-periods" role="group" aria-label="Report period">
      ${PERIODS.map((period) => `<button type="button" class="segmented-item ${state.period === period.value ? 'is-active' : ''}" data-period="${period.value}" aria-pressed="${state.period === period.value}">${period.label}</button>`).join('')}
    </div>

    <div class="period-extra">
      ${monthSwitchVisible ? monthSwitcher(state.selectedMonth, { id: 'report-month' }) : ''}
      ${state.period === 'custom' ? `<div class="period-custom">
        <div class="field">
          <label class="field-label" for="report-start">From</label>
          <input class="input" type="date" id="report-start" value="${escapeHTML(state.start)}" max="${todayISO()}">
        </div>
        <div class="field">
          <label class="field-label" for="report-end">To</label>
          <input class="input" type="date" id="report-end" value="${escapeHTML(state.end)}" max="${todayISO()}">
        </div>
        <div class="period-custom-actions">
          <button class="btn btn-secondary" type="button" id="report-apply">Apply dates</button>
        </div>
        <p class="field-error" id="report-range-error" style="display:none;grid-column:1/-1"></p>
      </div>` : ''}
    </div>

    <section class="report-hero" aria-label="Spending summary">
      <div class="report-hero-top">
        <div>
          <p class="hero-label">Recorded spending</p>
          <p class="report-total"><span class="cur">PKR</span>${escapeHTML(formatPKR(summary.total, { showCurrency: false }))}</p>
          <p class="report-period-label">${escapeHTML(periodLabel)}</p>
        </div>
        <span class="hero-chip">${icon('calendar', 12)}${state.period === 'month' ? 'Monthly' : state.period === 'today' ? 'Daily' : 'Custom'}</span>
      </div>
      <div class="report-split">
        <div class="report-split-cell">
          <span><i class="legend-dot shop"></i>Shop</span>
          <strong>${escapeHTML(formatPKR(summary.shop))}</strong>
        </div>
        <div class="report-split-cell">
          <span><i class="legend-dot home"></i>Home</span>
          <strong>${escapeHTML(formatPKR(summary.home))}</strong>
        </div>
      </div>
      <p class="report-equation">Shop ${escapeHTML(formatPercent(summary.shop, summary.total))} + Home ${escapeHTML(formatPercent(summary.home, summary.total))} = ${escapeHTML(formatPKR(summary.total))}</p>
    </section>

    ${state.period !== 'today' ? `<div class="card report-cards">
      <div class="report-card-head">
        <h2>Today at a glance</h2>
        <span>${escapeHTML(formatDate(todayISO(), 'medium'))}</span>
      </div>
      <div class="today-grid">
        <div class="today-cell"><span>Shop</span><strong>${escapeHTML(formatPKR(todaySummary.shop))}</strong></div>
        <div class="today-cell"><span>Home</span><strong>${escapeHTML(formatPKR(todaySummary.home))}</strong></div>
      </div>
      <div class="today-total"><span>Today’s combined spending</span><strong>${escapeHTML(formatPKR(todaySummary.total))}</strong></div>
    </div>` : ''}

    ${(workersPaid > 0 || summary.repayment > 0) ? `<div class="card report-cards">
      <div class="report-card-head">
        <h2>Worker money</h2>
        <span>Not sales-related</span>
      </div>
      <div class="kv-list">
        <div class="kv-row"><span>Worker payments (included in Shop)</span><strong>${escapeHTML(formatPKR(workersPaid))}</strong></div>
        <div class="kv-row"><span>Repayments received (not spending)</span><strong>${escapeHTML(formatPKR(summary.repayment))}</strong></div>
        <div class="kv-row"><span>Net worker cost</span><strong>${escapeHTML(workersNet < 0 ? `− ${formatPKR(Math.abs(workersNet))}` : formatPKR(workersNet))}</strong></div>
      </div>
      <p class="report-note">Net worker cost = payments out − repayments received. Repayments never increase Shop spending.</p>
    </div>` : ''}

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>${chartTitle}</h2>
        <span>${escapeHTML(periodLabel)}</span>
      </div>
      ${chartMarkup(seriesInfo.items, { monthly: seriesInfo.monthly })}
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>Spending by description</h2>
        <span>Shop + Home</span>
      </div>
      ${topDescriptions.length ? `<div class="breakdown-list">
        ${topDescriptions.map((entry) => `<div class="breakdown-row">
          <span class="breakdown-label">${escapeHTML(entry.label)}</span>
          <span class="breakdown-amount">${escapeHTML(formatPKR(entry.amount))}</span>
          <span class="breakdown-bar"><span class="breakdown-fill" style="width:${descriptionMax > 0 ? ((entry.paisa / descriptionMax) * 100).toFixed(2) : 0}%"></span></span>
          <span class="breakdown-sub">${entry.count} ${entry.count === 1 ? 'entry' : 'entries'} · ${escapeHTML(formatPercent(entry.amount, summary.total))} of spending</span>
        </div>`).join('')}
      </div>
      ${descriptions.length > topDescriptions.length ? `<p class="report-note">Showing the 7 largest descriptions. Use All transactions to see every record.</p>` : ''}
      ` : '<p class="inline-empty">No descriptions to show for this period.</p>'}
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>Workers in this period</h2>
        <a class="text-link" href="#/workers">Manage ${icon('chevron-right', 12)}</a>
      </div>
      ${workerRows.length ? `<div>
        ${workerRows.map((entry) => {
          const href = entry.worker ? `#/workers/${encodeURIComponent(entry.worker.id)}` : '';
          const content = `
            ${avatar(entry.name, { size: 38, id: entry.id })}
            <span class="report-worker-main">
              <span class="report-worker-name">${escapeHTML(entry.name)}</span>
              <span class="report-worker-sub">${entry.count === 1 ? '1 payment' : `${entry.count} payments`}${entry.repaidPaisa > 0 ? ` · ${escapeHTML(formatPKR(fromPaisa(entry.repaidPaisa)))} repaid` : ''}</span>
            </span>
            <span class="report-worker-amount">
              <strong>${escapeHTML(formatPKR(fromPaisa(entry.paidPaisa)))}</strong>
              <span>paid</span>
            </span>
            ${entry.worker ? icon('chevron-right', 14, 'chev') : ''}`;
          return href
            ? `<a class="report-worker" href="${href}">${content}</a>`
            : `<div class="report-worker">${content}</div>`;
        }).join('')}
      </div>` : '<p class="inline-empty">No worker payments in this period. General shop costs and household spending are still included above.</p>'}
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>${breakdownTitle}</h2>
        <span>${escapeHTML(periodLabel)}</span>
      </div>
      ${dayBreakdownMarkup(seriesInfo.items, { monthly: seriesInfo.monthly })}
      <p class="report-note">Tap a row to open those transactions. Shop and Home bars share the same scale.</p>
    </div>

    <div class="alert alert-info mt-16">
      <span class="alert-icon">${icon('shield', 18)}</span>
      <div class="alert-body">
        <strong>Expenses, not accounting</strong>
        <p>These reports contain only money you recorded as spent. PocketSplit has no sales, stock or customer data, so it never claims to show pharmacy profit.</p>
      </div>
    </div>

    <div class="data-footnote">
      ${icon('lock', 14)}
      <span>Every report is calculated live from the records saved on this iPhone. ${categoryMax > 0 ? 'Changing or deleting a record updates these figures immediately.' : 'Add an expense to begin.'}</span>
    </div>
    <div class="page-end"></div>
  `;

  // Period tabs
  root.querySelectorAll('[data-period]').forEach((button) => {
    button.addEventListener('click', async () => {
      const period = button.dataset.period;
      const next = { ...state, period };
      const query = new URLSearchParams({ period });
      if (period === 'month') query.set('m', state.selectedMonth);
      if (period === 'custom') {
        query.set('start', state.period === 'custom' ? state.start : monthRange(state.selectedMonth).start);
        query.set('end', state.period === 'custom' ? state.end : todayISO());
      }
      syncHash(`#/reports?${query.toString()}`);
      await render(root, resolvePeriodState(query));
    });
  });

  // Month switcher
  const monthEl = root.querySelector('#report-month');
  if (monthEl) {
    const goMonth = async (monthKey) => {
      if (monthKey > currentMonthKey()) return;
      const query = new URLSearchParams({ period: 'month', m: monthKey });
      syncHash(`#/reports?${query.toString()}`);
      await render(root, resolvePeriodState(query));
    };
    monthEl.querySelector('[data-month-prev]')?.addEventListener('click', () => goMonth(shiftMonth(state.selectedMonth, -1)));
    monthEl.querySelector('[data-month-next]')?.addEventListener('click', () => {
      const next = shiftMonth(state.selectedMonth, 1);
      if (next <= currentMonthKey()) goMonth(next);
    });
    monthEl.querySelector('[data-month-open]')?.addEventListener('click', async () => {
      const chosen = await openMonthPicker(state.selectedMonth);
      if (chosen && chosen !== state.selectedMonth) goMonth(chosen);
    });
  }

  // Custom range
  const applyCustom = async () => {
    const start = root.querySelector('#report-start').value;
    const end = root.querySelector('#report-end').value;
    const error = root.querySelector('#report-range-error');
    if (!validDateISO(start) || !validDateISO(end)) {
      error.textContent = 'Choose both a start date and an end date.';
      error.style.display = 'block';
      return;
    }
    if (start > end) {
      error.textContent = 'The start date must be on or before the end date.';
      error.style.display = 'block';
      return;
    }
    if (end > todayISO()) {
      error.textContent = 'The end date cannot be in the future.';
      error.style.display = 'block';
      return;
    }
    const query = new URLSearchParams({ period: 'custom', start, end });
    syncHash(`#/reports?${query.toString()}`);
    await render(root, resolvePeriodState(query));
  };

  root.querySelector('#report-apply')?.addEventListener('click', applyCustom);
  root.querySelectorAll('#report-start, #report-end').forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyCustom();
      }
    });
  });

  // Normalise the address bar for deep links.
  syncHash(`#/reports?${periodQuery(state)}`);
}

export async function run(root, params) {
  const state = resolvePeriodState(params);
  await render(root, state);
}
