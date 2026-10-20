/*
 * Expenses: Shop/Home feeds, full transaction history, and the add/edit form.
 */

import {
  PAYMENT_TYPES, SECTIONS, addDaysISO, currentMonthKey, debounce,
  expensesOnly, formatAmountInput, formatDate, formatPKR, formatRange,
  formatTime, fromPaisa, monthLabel, monthRange, normalizeText, nowTime,
  parseAmount, pluralize, shiftMonth, sumPaisa, toPaisa, todayISO, totals,
  validDateISO, validMonthKey, validTimeHHMM, filterTransactions, escapeHTML
} from '../utils.js';
import {
  backButton, emptyState, icon, iconButton, monthSwitcher,
  openMonthPicker, openSheet, confirmDialog, showToast, transactionGroups,
  paymentTypeOptions, alertBox
} from '../components.js';
import {
  deleteTransaction, getAllTransactions, getAllWorkers, getTransaction,
  saveTransaction, saveWorker
} from '../db.js';

/* ================================================================== */
/* Shared helpers                                                     */
/* ================================================================== */

function syncHash(hash) {
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }
}

function validSection(value, fallback = 'shop') {
  return value === 'shop' || value === 'home' ? value : fallback;
}

function wireMonthSwitch(root, month, onChange) {
  const switcher = root.querySelector('#month-switch');
  if (!switcher) return;
  switcher.querySelector('[data-month-prev]')?.addEventListener('click', () => {
    onChange(shiftMonth(month, -1));
  });
  switcher.querySelector('[data-month-next]')?.addEventListener('click', () => {
    const next = shiftMonth(month, 1);
    if (next <= currentMonthKey()) onChange(next);
  });
  switcher.querySelector('[data-month-open]')?.addEventListener('click', async () => {
    const chosen = await openMonthPicker(month);
    if (chosen && chosen !== month) onChange(chosen);
  });
}

function backTargetFrom(from, section) {
  if (!from) return `#/${section}`;
  if (from.startsWith('worker:')) {
    const rest = from.slice('worker:'.length);
    const [workerId, query = ''] = rest.split('?');
    if (/^[A-Za-z0-9_-]+$/.test(workerId)) {
      return `#/workers/${encodeURIComponent(workerId)}${query ? `?${query}` : ''}`;
    }
  }
  if (from === 'history' || from.startsWith('history?')) return `#/${from}`;
  if (['overview', 'shop', 'home', 'workers', 'reports', 'backup'].includes(from)) return `#/${from}`;
  return `#/${section}`;
}

/* ================================================================== */
/* Shop / Home section pages                                          */
/* ================================================================== */

function sectionSuggestions(allTransactions, section) {
  const defaults = section === 'shop'
    ? ['Worker salary', 'Workers lunch', 'Electricity bill', 'Shop supplies', 'Rent']
    : ['Groceries', 'Chicken', 'Beef', 'Mutton', 'Electricity bill', 'Shopping'];
  const recent = [];
  const seen = new Set();
  allTransactions.forEach((tx) => {
    if (tx.section !== section || tx.direction === 'in') return;
    const key = String(tx.description || '').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    recent.push(String(tx.description).trim());
  });
  defaults.forEach((label) => {
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      recent.push(label);
    }
  });
  return recent.slice(0, 6);
}

function workerCardMarkup(workers, paidThisMonth) {
  return `<a class="workers-card" href="#/workers">
    <span class="wc-icon">${icon('users', 18)}</span>
    <span>
      <strong>Workers${workers.length ? ` · ${workers.length}` : ''}</strong>
      <span>${workers.length
        ? `${formatPKR(paidThisMonth)} paid this month`
        : 'Add workers to track salaries, advances and repayments'}</span>
    </span>
    ${icon('chevron-right', 16, 'chev')}
  </a>`;
}

export async function runSection(root, params, section) {
  const activeSection = validSection(section);
  const meta = SECTIONS[activeSection];
  let month = params.get('m');
  if (!validMonthKey(month) || month > currentMonthKey()) month = currentMonthKey();

  const [monthsTransactions, workers] = await Promise.all([
    getAllTransactions(),
    getAllWorkers()
  ]);

  const { start, end } = monthRange(month);
  const monthTransactions = filterTransactions(monthsTransactions, {
    section: activeSection, start, end
  });
  const sectionTotals = totals(monthTransactions);
  const entries = expensesOnly(monthTransactions);
  const hasRecordsAnywhere = monthsTransactions.some((tx) => tx.section === activeSection);
  const average = entries.length
    ? fromPaisa(Math.round(sumPaisa(entries) / entries.length))
    : 0;
  const largest = entries.length
    ? fromPaisa(Math.max(...entries.map((tx) => toPaisa(tx.amount))))
    : 0;
  const workerPay = sectionTotals.worker;
  const otherPay = fromPaisa(sectionTotals.shopPaisa - sectionTotals.workerPaisa);

  const miniStats = activeSection === 'shop'
    ? [
        { label: 'Worker pay', value: formatPKR(workerPay) },
        { label: 'Other shop costs', value: formatPKR(otherPay) }
      ]
    : [
        { label: 'Average entry', value: formatPKR(average) },
        { label: 'Largest entry', value: formatPKR(largest) }
      ];

  const subtitle = activeSection === 'shop'
    ? 'Salaries, bills, supplies and every other cost the shop pays.'
    : 'Groceries, meat, clothes and the everyday cost of running a home.';

  root.innerHTML = `
    <div class="page-top">
      ${backButton('#/overview', 'Back to overview')}
      <div class="page-top-actions">
        ${iconButton({ icon: 'search', label: 'Search transactions', href: `#/history?section=${activeSection}` })}
        ${iconButton({ icon: 'plus', label: 'Add expense', href: `#/add?section=${activeSection}` })}
      </div>
    </div>

    <header class="page-heading">
      <div class="page-heading-main">
        <p class="eyebrow">PocketSplit · ${meta.label}</p>
        <h1 class="page-title">
          <span class="title-icon ${meta.className}">${icon(meta.icon === 'home' ? 'home' : 'store', 19)}</span>
          ${activeSection === 'shop' ? 'Shop' : 'Home'} expenses
        </h1>
        <p class="page-sub">${subtitle}</p>
      </div>
    </header>

    <div class="dash-month">
      ${monthSwitcher(month, { id: 'month-switch' })}
    </div>

    <section class="section-summary" aria-label="${escapeHTML(meta.label)} summary for ${escapeHTML(monthLabel(month))}">
      <div class="section-summary-top">
        <div>
          <p class="summary-kicker">Spent in ${escapeHTML(monthLabel(month, 'short'))}</p>
          <p class="summary-big">${escapeHTML(formatPKR(sectionTotals.total))}</p>
          <p class="summary-detail">
            <span>${entries.length === 0 ? 'No entries' : pluralize(entries.length, 'entry', 'entries')}</span>
            ${sectionTotals.workerCount ? `<span class="dot-sep">·</span><span>${pluralize(sectionTotals.workerCount, 'worker payment')}</span>` : ''}
            ${sectionTotals.repaymentCount ? `<span class="dot-sep">·</span><span>${formatPKR(sectionTotals.repayment)} repaid to you (not counted)</span>` : ''}
          </p>
        </div>
      </div>
      <div class="mini-stats">
        ${miniStats.map((stat) => `<div class="mini-stat"><span>${escAttr(stat.label)}</span><strong>${escapeHTML(stat.value)}</strong></div>`).join('')}
      </div>
      <a class="btn btn-primary btn-lg btn-block mt-16" href="#/add?section=${activeSection}">
        ${icon('plus', 20)}Add ${activeSection === 'shop' ? 'shop' : 'home'} expense
      </a>
    </section>

    ${activeSection === 'shop' ? workerCardMarkup(workers, workerPay) : ''}

    <div class="list-head">
      <h2>${monthLabel(month, 'short')} expenses</h2>
      <span>${entries.length === 0 ? 'Nothing yet' : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}</span>
    </div>

    ${entries.length
      ? transactionGroups(entries, { showSection: false, from: activeSection })
      : emptyState({
          icon: activeSection === 'shop' ? 'store' : 'home',
          tone: activeSection === 'home' ? 'beige' : 'sage',
          title: hasRecordsAnywhere ? `No ${meta.label.toLowerCase()} expenses in ${monthLabel(month, 'short')}` : `No ${meta.label.toLowerCase()} expenses yet`,
          text: hasRecordsAnywhere
            ? 'Try another month, or record a new expense for this one.'
            : activeSection === 'shop'
              ? 'Start with a salary, an electricity bill, or the workers’ lunch. It takes a few seconds.'
              : 'Start with groceries, meat or a household bill. The date and time are filled in for you.',
          actionLabel: 'Add expense',
          actionHref: `#/add?section=${activeSection}`,
          secondaryLabel: hasRecordsAnywhere ? 'View all transactions' : '',
          secondaryHref: `#/history?section=${activeSection}`
        })}

    <div class="data-footnote">
      ${icon(activeSection === 'shop' ? 'store' : 'home', 14)}
      <span>${activeSection === 'shop'
        ? 'Shop totals include only Shop records. Worker repayments are tracked separately and never increase spending.'
        : 'Home totals include only Home records. They never mix with shop spending.'}</span>
    </div>
    <div class="page-end"></div>
  `;

  wireMonthSwitch(root, month, async (nextMonth) => {
    syncHash(`#/${activeSection}?m=${nextMonth}`);
    await runSection(root, new URLSearchParams({ m: nextMonth }), activeSection);
  });
}

// Tiny local helper so labels can contain apostrophes safely.
function escAttr(value) {
  return escapeHTML(value);
}

/* ================================================================== */
/* Transaction history                                                */
/* ================================================================== */

const RANGE_PRESETS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'lastmonth', label: 'Last month' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom dates' }
];

function resolvePeriod(state) {
  const today = todayISO();
  switch (state.range) {
    case 'today':
      return { start: today, end: today, label: 'Today' };
    case 'month': {
      const range = monthRange(currentMonthKey());
      return { ...range, label: 'This month' };
    }
    case 'lastmonth': {
      const range = monthRange(shiftMonth(currentMonthKey(), -1));
      return { ...range, label: 'Last month' };
    }
    case 'last30':
      return { start: addDaysISO(today, -29), end: today, label: 'Last 30 days' };
    case 'custom': {
      const start = validDateISO(state.start) ? state.start : monthRange(currentMonthKey()).start;
      const end = validDateISO(state.end) ? state.end : today;
      return { start, end, label: formatRange(start, end) };
    }
    default:
      return { start: null, end: null, label: 'All time' };
  }
}

function rangeSheet(current) {
  return new Promise((resolve) => {
    const initialPeriod = resolvePeriod(current);
    const layer = openSheet({
      title: 'Filter by date',
      content: `
        <div class="filter-sheet-group">
          <p class="filter-sheet-label">Quick range</p>
          <div class="preset-grid" data-preset-grid>
            ${RANGE_PRESETS.filter((preset) => preset.value !== 'custom').map((preset) => `
              <button type="button" class="preset-btn ${current.range === preset.value ? 'is-selected' : ''}" data-preset="${preset.value}">
                ${escapeHTML(preset.label)}
              </button>`).join('')}
            <button type="button" class="preset-btn ${current.range === 'custom' ? 'is-selected' : ''}" data-preset="custom">
              Custom dates
            </button>
          </div>
        </div>
        <div class="filter-sheet-group" data-custom-group ${current.range === 'custom' ? '' : 'hidden'}>
          <p class="filter-sheet-label">Custom dates</p>
          <div class="range-inputs">
            <div class="field">
              <label class="field-label" for="filter-start">From</label>
              <input class="input" type="date" id="filter-start" value="${escapeHTML(initialPeriod.start || todayISO())}" max="${todayISO()}">
            </div>
            <div class="field">
              <label class="field-label" for="filter-end">To</label>
              <input class="input" type="date" id="filter-end" value="${escapeHTML(initialPeriod.end || todayISO())}" max="${todayISO()}">
            </div>
          </div>
          <p class="field-error" data-range-error style="display:none"></p>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-secondary" type="button" data-cancel>Cancel</button>
          <button class="btn btn-primary" type="button" data-apply>Apply filter</button>
        </div>`,
      onMount(sheet, close) {
        let selected = RANGE_PRESETS.some((preset) => preset.value === current.range) ? current.range : 'all';
        const customGroup = sheet.querySelector('[data-custom-group]');
        const errorEl = sheet.querySelector('[data-range-error]');
        const setSelected = (value) => {
          selected = value;
          sheet.querySelectorAll('[data-preset]').forEach((button) => {
            button.classList.toggle('is-selected', button.dataset.preset === value);
          });
          customGroup.hidden = value !== 'custom';
          errorEl.style.display = 'none';
        };

        sheet.querySelector('[data-preset-grid]').addEventListener('click', (event) => {
          const button = event.target.closest('[data-preset]');
          if (button) setSelected(button.dataset.preset);
        });

        sheet.querySelector('[data-cancel]').addEventListener('click', () => close(null));
        sheet.querySelector('[data-apply]').addEventListener('click', () => {
          if (selected === 'custom') {
            const start = sheet.querySelector('#filter-start').value;
            const end = sheet.querySelector('#filter-end').value;
            if (!validDateISO(start) || !validDateISO(end)) {
              errorEl.textContent = 'Choose both a start date and an end date.';
              errorEl.style.display = 'block';
              return;
            }
            if (start > end) {
              errorEl.textContent = 'The start date must be on or before the end date.';
              errorEl.style.display = 'block';
              return;
            }
            if (end > todayISO()) {
              errorEl.textContent = 'The end date cannot be in the future.';
              errorEl.style.display = 'block';
              return;
            }
            close({ range: 'custom', start, end });
          } else {
            close({ range: selected, start: null, end: null });
          }
        });
      }
    });
    layer.onClose = (result) => resolve(result || null);
  });
}

export async function runHistory(root, params) {
  const allTransactions = await getAllTransactions();

  const initialSection = ['all', 'shop', 'home'].includes(params.get('section'))
    ? params.get('section')
    : 'all';
  let rangeParam = params.get('range');
  if (!RANGE_PRESETS.some((preset) => preset.value === rangeParam)) rangeParam = 'all';
  const customStart = params.get('start') || '';
  const customEnd = params.get('end') || '';

  const state = {
    section: initialSection,
    range: rangeParam,
    start: validDateISO(customStart) ? customStart : monthRange(currentMonthKey()).start,
    end: validDateISO(customEnd) ? customEnd : todayISO(),
    q: (params.get('q') || '').slice(0, 100),
    visible: 50
  };

  root.innerHTML = `
    <div class="page-top">
      ${backButton('#/overview', 'Back to overview')}
      <div class="page-top-actions">
        ${iconButton({ icon: 'plus', label: 'Add expense', href: '#/add' })}
      </div>
    </div>

    <header class="page-heading">
      <div class="page-heading-main">
        <p class="eyebrow">Your ledger</p>
        <h1 class="page-title">All transactions</h1>
        <p class="page-sub">Search, filter, edit or delete any record. Nothing is hidden.</p>
      </div>
    </header>

    <div class="search-field">
      ${icon('search', 18, 'search-icon')}
      <input class="search-input" id="history-search" type="search" dir="auto" placeholder="Search description, worker or note" value="${escapeHTML(state.q)}" autocomplete="off" enterkeyhint="search" aria-label="Search transactions">
      <button class="search-clear" id="search-clear" type="button" aria-label="Clear search" ${state.q ? '' : 'hidden'}>
        ${icon('x', 16)}
      </button>
    </div>

    <div class="filter-block">
      <div class="segmented" id="history-sections" role="group" aria-label="Filter by pocket">
        <button type="button" class="segmented-item ${state.section === 'all' ? 'is-active' : ''}" data-section-filter="all" aria-pressed="${state.section === 'all'}">All</button>
        <button type="button" class="segmented-item ${state.section === 'shop' ? 'is-active' : ''}" data-section-filter="shop" aria-pressed="${state.section === 'shop'}">${icon('store', 15)}Shop</button>
        <button type="button" class="segmented-item ${state.section === 'home' ? 'is-active' : ''}" data-section-filter="home" aria-pressed="${state.section === 'home'}">${icon('home', 15)}Home</button>
      </div>
      <div class="filter-row">
        <button class="range-btn" type="button" id="range-button">
          ${icon('calendar', 17)}
          <span class="range-label" id="range-label">${escapeHTML(resolvePeriod(state).label)}</span>
          ${icon('chevron-down', 15)}
        </button>
        <button class="btn btn-secondary btn-sm" type="button" id="clear-all" style="height:42px" ${state.section === 'all' && state.range === 'all' && !state.q ? 'hidden' : ''}>Clear</button>
      </div>
    </div>

    <div id="history-summary" aria-live="polite"></div>
    <div id="history-list"></div>
    <div class="page-end"></div>
  `;

  const searchInput = root.querySelector('#history-search');
  const clearSearch = root.querySelector('#search-clear');
  const rangeLabel = root.querySelector('#range-label');
  const summaryHost = root.querySelector('#history-summary');
  const listHost = root.querySelector('#history-list');
  const clearAll = root.querySelector('#clear-all');

  function buildQueryString() {
    const query = new URLSearchParams();
    if (state.section !== 'all') query.set('section', state.section);
    if (state.range !== 'all') query.set('range', state.range);
    if (state.range === 'custom') {
      query.set('start', state.start);
      query.set('end', state.end);
    }
    if (state.q) query.set('q', state.q);
    return query.toString();
  }

  function syncUrl() {
    const queryString = buildQueryString();
    syncHash(`#/history${queryString ? `?${queryString}` : ''}`);
  }

  function currentFrom() {
    const queryString = buildQueryString();
    return `history${queryString ? `?${queryString}` : ''}`;
  }

  function updateFilterChrome() {
    root.querySelectorAll('[data-section-filter]').forEach((button) => {
      const active = button.dataset.sectionFilter === state.section;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    rangeLabel.textContent = resolvePeriod(state).label;
    const hasFilters = state.section !== 'all' || state.range !== 'all' || Boolean(state.q);
    clearAll.hidden = !hasFilters;
    clearSearch.hidden = !searchInput.value;
  }

  function renderResults() {
    const period = resolvePeriod(state);
    const filtered = filterTransactions(allTransactions, {
      section: state.section,
      start: period.start,
      end: period.end,
      query: state.q
    });
    const expenses = expensesOnly(filtered);
    const summary = totals(filtered);
    const visible = filtered.slice(0, state.visible);
    const remaining = filtered.length - visible.length;

    summaryHost.innerHTML = `
      <div class="results-summary">
        <div>
          <strong>${filtered.length === 1 ? '1 record' : `${filtered.length} records`}</strong>
          <div>${escapeHTML(period.label)}${state.section !== 'all' ? ` · ${SECTIONS[state.section].label}` : ''}</div>
        </div>
        <div class="results-total">
          <strong>${escapeHTML(formatPKR(summary.out))}</strong>
          <span>spent${summary.in > 0 ? ` · ${escapeHTML(formatPKR(summary.in))} received` : ''}</span>
        </div>
      </div>`;

    if (!filtered.length) {
      const noResultsTitle = state.q ? 'No matching transactions' : 'No transactions in this range';
      const noResultsText = state.q
        ? `Nothing matches “${state.q}”. Try a shorter word, a worker’s name, or clear the filters.`
        : 'Change the date range or pocket filter, or record a new expense.';
      listHost.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${icon('search', 26)}</div>
        <h2 class="empty-title">${escapeHTML(noResultsTitle)}</h2>
        <p class="empty-text">${escapeHTML(noResultsText)}</p>
        <button class="btn btn-secondary btn-block" type="button" data-clear-filters>Clear all filters</button>
        <a class="btn btn-primary btn-block mt-12" href="#/add">${icon('plus', 18)}Add expense</a>
      </div>`;
      listHost.querySelector('[data-clear-filters]')?.addEventListener('click', () => resetFilters());
      return;
    }

    const from = currentFrom();
    listHost.innerHTML = `
      ${transactionGroups(visible, { showSection: state.section === 'all', from })}
      ${remaining > 0 ? `<button class="btn btn-secondary btn-block load-more" type="button" data-load-more>Show more transactions <span class="count-pill">${remaining}</span></button>` : ''}`;

    listHost.querySelector('[data-load-more]')?.addEventListener('click', () => {
      state.visible += 50;
      renderResults();
    });
  }

  function resetFilters() {
    state.section = 'all';
    state.range = 'all';
    state.q = '';
    state.visible = 50;
    searchInput.value = '';
    updateFilterChrome();
    syncUrl();
    renderResults();
  }

  const searchNow = debounce(() => {
    state.q = searchInput.value.trim();
    state.visible = 50;
    updateFilterChrome();
    syncUrl();
    renderResults();
  }, 220);

  searchInput.addEventListener('input', () => {
    clearSearch.hidden = !searchInput.value;
    searchNow();
  });

  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    state.q = '';
    state.visible = 50;
    searchInput.focus();
    updateFilterChrome();
    syncUrl();
    renderResults();
  });

  root.querySelector('#history-sections').addEventListener('click', (event) => {
    const button = event.target.closest('[data-section-filter]');
    if (!button) return;
    state.section = button.dataset.sectionFilter;
    state.visible = 50;
    updateFilterChrome();
    syncUrl();
    renderResults();
  });

  root.querySelector('#range-button').addEventListener('click', async () => {
    const chosen = await rangeSheet(state);
    if (!chosen) return;
    state.range = chosen.range;
    state.start = chosen.start || state.start;
    state.end = chosen.end || state.end;
    state.visible = 50;
    updateFilterChrome();
    syncUrl();
    renderResults();
  });

  clearAll.addEventListener('click', resetFilters);

  updateFilterChrome();
  renderResults();
}

/* ================================================================== */
/* Add / edit expense form                                            */
/* ================================================================== */

function formSuggestions(transactions, section) {
  return sectionSuggestions(transactions, section);
}

function dateSummary(date, time) {
  if (!validDateISO(date) || !validTimeHHMM(time)) return 'Choose date and time';
  const today = todayISO();
  if (date === today) return `Today · ${formatTime(time)}`;
  if (date === addDaysISO(today, -1)) return `Yesterday · ${formatTime(time)}`;
  return `${formatDate(date, 'medium')} · ${formatTime(time)}`;
}

function noteSummary(note) {
  const value = normalizeText(note, 500);
  if (!value) return 'Add a note';
  return value.length > 32 ? `${value.slice(0, 32)}…` : value;
}

function workerSummary(worker, paymentType) {
  if (!worker) return 'Optional · salary, advance or repayment';
  if (!paymentType) return worker.name;
  return `${worker.name} · ${paymentType}`;
}

function workerSheet({ onSaved }) {
  openSheet({
    title: 'Add worker',
    content: `
      <form class="sheet-form" id="quick-worker-form" novalidate>
        <div class="field">
          <label class="field-label" for="quick-worker-name">Worker’s name</label>
          <input class="input" id="quick-worker-name" name="name" type="text" dir="auto" maxlength="80" autocomplete="off" placeholder="e.g. Ali Raza" data-autofocus>
          <p class="field-error" data-error></p>
        </div>
        <p class="worker-sheet-note">Only a name is needed. You can record salary, advance, additional payments and repayments for this worker.</p>
        <div class="form-actions-row">
          <button class="btn btn-secondary" type="button" data-layer-close>Cancel</button>
          <button class="btn btn-primary" type="submit">Add worker</button>
        </div>
      </form>`,
    onMount(sheet, close) {
      const form = sheet.querySelector('#quick-worker-form');
      const input = sheet.querySelector('#quick-worker-name');
      const field = input.closest('.field');
      const error = sheet.querySelector('[data-error]');
      input.focus();
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        field.classList.remove('has-error');
        const name = normalizeText(input.value, 80);
        if (name.length < 2) {
          field.classList.add('has-error');
          error.textContent = 'Enter the worker’s name (at least 2 characters).';
          input.focus();
          return;
        }
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        submit.textContent = 'Adding…';
        try {
          const worker = await saveWorker({ name });
          close(worker);
        } catch (err) {
          field.classList.add('has-error');
          error.textContent = err.message || 'The worker could not be saved.';
          submit.disabled = false;
          submit.textContent = 'Add worker';
        }
      });
    }
  }).onClose = (worker) => {
    if (worker) onSaved(worker);
  };
}

export async function runForm(root, params, editingId) {
  const editing = Boolean(editingId);
  let existing = null;

  const [workersInitial, allTransactions] = await Promise.all([
    getAllWorkers(),
    getAllTransactions()
  ]);

  if (editing) {
    existing = await getTransaction(editingId);
    if (!existing) {
      root.innerHTML = `
        <div class="page-top">${backButton('#/shop', 'Back to shop')}</div>
        <div class="mt-20">
          ${emptyState({
            icon: 'alert',
            title: 'Expense not found',
            text: 'This record may have been deleted, or the link is incomplete. Your other records are unchanged.',
            actionLabel: 'View all transactions',
            actionHref: '#/history'
          })}
        </div>`;
      return;
    }
  }

  const workers = [...workersInitial];
  let currentSection = editing ? validSection(existing.section) : validSection(params.get('section'));
  let from = (params.get('from') || (editing ? currentSection : currentSection)).slice(0, 300);

  const requestedWorker = params.get('worker');
  const requestedType = params.get('type');
  const initialWorker = editing
    ? existing.workerId
    : (workers.some((worker) => worker.id === requestedWorker) ? requestedWorker : null);
  const initialType = editing
    ? existing.paymentType
    : (PAYMENT_TYPES.some((type) => type.value === requestedType) ? requestedType : null);

  const initial = {
    description: editing ? existing.description : (params.get('desc') || ''),
    amount: editing ? formatAmountInput(existing.amount) : '',
    date: editing ? existing.date : todayISO(),
    time: editing ? existing.time : nowTime(),
    workerId: initialWorker || '',
    paymentType: initialType || (initialWorker ? 'Salary' : ''),
    note: editing ? (existing.note || '') : ''
  };

  const suggestionsBySection = {
    shop: formSuggestions(allTransactions, 'shop'),
    home: formSuggestions(allTransactions, 'home')
  };

  const title = editing ? 'Edit expense' : `New ${currentSection} expense`;
  const subtitle = editing ? 'Changes update your totals immediately' : 'Date and time are filled in automatically';

  function workerById(id) {
    return workers.find((worker) => worker.id === id) || null;
  }

  const selectedWorker = workerById(initial.workerId);

  root.innerHTML = `
    <form id="expense-form" class="form-page" novalidate>
      <div class="form-topbar">
        <button class="icon-btn back-btn" type="button" data-form-back aria-label="Go back">${icon('chevron-left', 22)}</button>
        <div class="form-topbar-title">
          <h1 id="form-title" class="form-title">${escapeHTML(title)}</h1>
          <span id="form-subtitle">${escapeHTML(subtitle)}</span>
        </div>
        ${editing ? `<button class="icon-btn icon-btn-danger" type="button" data-delete aria-label="Delete this expense">${icon('trash', 19)}</button>` : `<span class="top-spacer"></span>`}
      </div>

      <div class="form-intro">
        <div class="segmented form-segmented" id="form-section" role="group" aria-label="Shop or Home">
          <button type="button" class="segmented-item ${currentSection === 'shop' ? 'is-active' : ''}" data-form-section="shop" aria-pressed="${currentSection === 'shop'}">${icon('store', 17)}Shop</button>
          <button type="button" class="segmented-item ${currentSection === 'home' ? 'is-active' : ''}" data-form-section="home" aria-pressed="${currentSection === 'home'}">${icon('home', 17)}Home</button>
        </div>
        <p class="field-help" id="section-help">${currentSection === 'shop' ? 'Money paid by the shop: salaries, bills, supplies, rent.' : 'Money spent on the household: groceries, meat, bills, shopping.'}</p>
      </div>

      <div class="field amount-card" data-field="amount">
        <div class="amount-top">
          <span>Amount</span>
          <span class="amount-cur-label">Pakistani rupees</span>
        </div>
        <div class="amount-input-wrap">
          <span class="amount-currency" aria-hidden="true">PKR</span>
          <input class="amount-input" id="expense-amount" dir="ltr" name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="${escapeHTML(initial.amount)}" aria-describedby="amount-error">
        </div>
        <p class="field-error" id="amount-error" data-error></p>
        <p class="amount-hint">Whole rupees or decimals, for example 1250 or 1250.50.</p>
      </div>

      <div class="field" data-field="description">
        <label class="field-label" for="expense-description">What was it for?</label>
        <input class="input" id="expense-description" name="description" type="text" dir="auto" maxlength="200" autocomplete="off" placeholder="${currentSection === 'shop' ? 'e.g. Worker salary, electricity bill' : 'e.g. Groceries, chicken, gas bill'}" value="${escapeHTML(initial.description)}" aria-describedby="description-error">
        <p class="field-error" id="description-error" data-error></p>
        <div class="suggestion-row" id="description-suggestions">
          ${suggestionsBySection[currentSection].map((label) => `<button type="button" class="suggestion-chip" data-suggestion="${escapeHTML(label)}">${escapeHTML(label)}</button>`).join('')}
        </div>
      </div>

      <div class="field mt-16" data-field="date">
        <details class="option-card" id="date-details">
          <summary>
            <span class="option-icon">${icon('calendar', 16)}</span>
            <span class="option-summary-text">
              <strong>Date &amp; time</strong>
              <span id="date-summary">${escapeHTML(dateSummary(initial.date, initial.time))}</span>
            </span>
            ${icon('chevron-down', 15, 'option-chev')}
          </summary>
          <div class="option-body">
            <div class="range-inputs" style="margin-top:0">
              <div class="field">
                <label class="field-label" for="expense-date">Date</label>
                <input class="input" id="expense-date" name="date" type="date" value="${escapeHTML(initial.date)}" max="${todayISO()}" required>
              </div>
              <div class="field">
                <label class="field-label" for="expense-time">Time</label>
                <input class="input" id="expense-time" name="time" type="time" value="${escapeHTML(initial.time)}" required>
              </div>
            </div>
            <p class="field-error" data-error></p>
            <button class="btn btn-ghost btn-sm mt-8" type="button" id="set-now">${icon('clock', 15)}Use current date and time</button>
          </div>
        </details>
      </div>

      <div class="field mt-12" id="worker-option" data-field="worker" ${currentSection === 'home' ? 'hidden' : ''}>
        <details class="option-card" id="worker-details" ${selectedWorker ? 'open' : ''}>
          <summary>
            <span class="option-icon">${icon('users', 16)}</span>
            <span class="option-summary-text">
              <strong>Worker payment <span class="label-note" style="font-weight:500">(optional)</span></strong>
              <span id="worker-summary">${escapeHTML(workerSummary(selectedWorker, initial.paymentType))}</span>
            </span>
            ${icon('chevron-down', 15, 'option-chev')}
          </summary>
          <div class="option-body">
            <div class="field">
              <label class="field-label" for="expense-worker">Worker</label>
              <div class="select-wrap">
                <select class="select" id="expense-worker" name="worker">
                  <option value="">No worker — just a shop expense</option>
                  ${workers.map((worker) => `<option value="${escapeHTML(worker.id)}" ${worker.id === initial.workerId ? 'selected' : ''}>${escapeHTML(worker.name)}</option>`).join('')}
                </select>
                ${icon('chevron-down', 16, 'select-chevron')}
              </div>
            </div>
            <div class="field" id="payment-type-field" ${initial.workerId ? '' : 'hidden'}>
              <label class="field-label" for="expense-payment-type">Payment type</label>
              <div class="select-wrap">
                <select class="select" id="expense-payment-type" name="paymentType">
                  ${paymentTypeOptions(initial.paymentType || 'Salary')}
                </select>
                ${icon('chevron-down', 16, 'select-chevron')}
              </div>
              <p class="info-line" id="payment-type-help">${escapeHTML(paymentTypeHelp(initial.paymentType || 'Salary'))}</p>
            </div>
            <div class="mini-add-worker">
              <span>Worker not listed?</span>
              <button class="btn btn-secondary" type="button" id="add-worker-inline">${icon('plus', 13)}Add worker</button>
            </div>
            <p class="info-line">${icon('info', 13)}<span>A worker name links this payment to their history. For lunch or general shop costs, choose “No worker”.</span></p>
          </div>
        </details>
      </div>

      <div class="field mt-12" data-field="note">
        <details class="option-card" id="note-details">
          <summary>
            <span class="option-icon">${icon('edit', 16)}</span>
            <span class="option-summary-text">
              <strong>Note <span class="label-note" style="font-weight:500">(optional)</span></strong>
              <span id="note-summary">${escapeHTML(noteSummary(initial.note))}</span>
            </span>
            ${icon('chevron-down', 15, 'option-chev')}
          </summary>
          <div class="option-body">
            <div class="field">
              <label class="field-label" for="expense-note">Anything worth remembering</label>
              <textarea class="textarea" id="expense-note" name="note" dir="auto" maxlength="500" placeholder="e.g. Paid in cash, advance for Eid">${escapeHTML(initial.note)}</textarea>
            </div>
          </div>
        </details>
      </div>

      <div id="form-error-host" class="inline-form-error"></div>

      <div class="form-footer">
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="save-expense">${editing ? 'Save changes' : 'Save expense'}</button>
        <p class="form-footer-note">${editing ? 'Updates the date, time and totals for this record.' : 'Saved on this iPhone. No internet needed.'}</p>
      </div>
    </form>
  `;

  const form = root.querySelector('#expense-form');
  const sectionButtons = [...root.querySelectorAll('[data-form-section]')];
  const amountInput = root.querySelector('#expense-amount');
  const descriptionInput = root.querySelector('#expense-description');
  const dateInput = root.querySelector('#expense-date');
  const timeInput = root.querySelector('#expense-time');
  const workerOption = root.querySelector('#worker-option');
  const workerSelect = root.querySelector('#expense-worker');
  const typeField = root.querySelector('#payment-type-field');
  const typeSelect = root.querySelector('#expense-payment-type');
  const noteInput = root.querySelector('#expense-note');
  const suggestionsHost = root.querySelector('#description-suggestions');
  const dateDetails = root.querySelector('#date-details');
  const noteDetails = root.querySelector('#note-details');
  const saveButton = root.querySelector('#save-expense');
  const errorHost = root.querySelector('#form-error-host');
  const titleEl = root.querySelector('#form-title');
  const subtitleEl = root.querySelector('#form-subtitle');
  const sectionHelp = root.querySelector('#section-help');
  const dateSummaryEl = root.querySelector('#date-summary');
  const noteSummaryEl = root.querySelector('#note-summary');
  const workerSummaryEl = root.querySelector('#worker-summary');
  const paymentHelp = root.querySelector('#payment-type-help');

  function paymentTypeHelp(value) {
    const type = PAYMENT_TYPES.find((entry) => entry.value === value);
    return type ? type.help : '';
  }

  function currentWorker() {
    return workerById(workerSelect.value);
  }

  function readValues() {
    return {
      section: currentSection,
      amount: amountInput.value,
      description: descriptionInput.value,
      date: dateInput.value,
      time: timeInput.value,
      workerId: currentSection === 'shop' ? workerSelect.value : '',
      paymentType: currentSection === 'shop' && workerSelect.value ? typeSelect.value : '',
      note: noteInput.value
    };
  }

  const initialSnapshot = JSON.stringify(readValues());

  function isDirty() {
    return JSON.stringify(readValues()) !== initialSnapshot;
  }

  function refreshDateSummary() {
    dateSummaryEl.textContent = dateSummary(dateInput.value, timeInput.value);
  }

  function refreshNoteSummary() {
    noteSummaryEl.textContent = noteSummary(noteInput.value);
  }

  function refreshWorkerUi() {
    const worker = currentWorker();
    if (worker) {
      typeField.hidden = false;
      if (!typeSelect.value) typeSelect.value = 'Salary';
    } else {
      typeField.hidden = true;
    }
    workerSummaryEl.textContent = workerSummary(worker, worker ? typeSelect.value : '');
    paymentHelp.textContent = paymentTypeHelp(typeSelect.value || 'Salary');
    const isRepayment = worker && typeSelect.value === 'Repayment';
    saveButton.textContent = editing
      ? 'Save changes'
      : isRepayment
        ? 'Save repayment'
        : 'Save expense';
  }

  function refreshSuggestions() {
    suggestionsHost.innerHTML = suggestionsBySection[currentSection]
      .map((label) => `<button type="button" class="suggestion-chip" data-suggestion="${escapeHTML(label)}">${escapeHTML(label)}</button>`)
      .join('');
  }

  function setSection(nextSection) {
    if (nextSection === currentSection) return;
    const hadWorker = Boolean(workerSelect.value);
    currentSection = nextSection;
    sectionButtons.forEach((button) => {
      const active = button.dataset.formSection === nextSection;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    sectionHelp.textContent = nextSection === 'shop'
      ? 'Money paid by the shop: salaries, bills, supplies, rent.'
      : 'Money spent on the household: groceries, meat, bills, shopping.';
    descriptionInput.placeholder = nextSection === 'shop'
      ? 'e.g. Worker salary, electricity bill'
      : 'e.g. Groceries, chicken, gas bill';
    workerOption.hidden = nextSection === 'home';
    if (nextSection === 'home') {
      workerSelect.value = '';
      typeSelect.value = '';
      typeField.hidden = true;
      if (hadWorker) {
        showToast('Worker details were cleared because this is now a Home expense.', { tone: 'info' });
      }
    }
    titleEl.textContent = editing ? 'Edit expense' : `New ${nextSection} expense`;
    subtitleEl.textContent = editing ? 'Changes update your totals immediately' : 'Date and time are filled in automatically';
    refreshWorkerUi();
    refreshSuggestions();
  }

  function clearFieldError(name) {
    const field = root.querySelector(`[data-field="${name}"]`);
    if (field) field.classList.remove('has-error');
  }

  function setFieldError(name, message, focusSelector = '') {
    const field = root.querySelector(`[data-field="${name}"]`);
    if (!field) return;
    field.classList.add('has-error');
    const error = field.querySelector('.field-error');
    if (error) error.textContent = message;
    const details = field.querySelector('details');
    if (details) details.open = true;
    if (focusSelector) {
      const input = root.querySelector(focusSelector);
      if (input) input.focus();
    }
  }

  function clearAllErrors() {
    root.querySelectorAll('.field').forEach((field) => field.classList.remove('has-error'));
    errorHost.innerHTML = '';
  }

  function showFormError(message) {
    errorHost.innerHTML = alertBox({ tone: 'danger', title: 'Could not save', text: message });
    errorHost.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function finalTarget(section) {
    return backTargetFrom(from, section);
  }

  function handleBack() {
    const target = finalTarget(currentSection);
    if (!isDirty()) {
      window.location.hash = target;
      return;
    }
    confirmDialog({
      title: 'Discard changes?',
      message: 'You have unsaved changes on this expense. Leaving now will lose them.',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      tone: 'warn'
    }).then((confirmed) => {
      if (confirmed) {
        window.location.hash = target;
      }
    });
  }

  root.querySelector('[data-form-back]').addEventListener('click', handleBack);

  form.addEventListener('input', (event) => {
    const field = event.target.closest('.field');
    if (field) field.classList.remove('has-error');
    if (event.target === dateInput || event.target === timeInput) refreshDateSummary();
    if (event.target === noteInput) refreshNoteSummary();
    errorHost.innerHTML = '';
  });

  form.addEventListener('change', (event) => {
    if (event.target === workerSelect) {
      if (workerSelect.value && !typeSelect.value) typeSelect.value = 'Salary';
      refreshWorkerUi();
    }
    if (event.target === typeSelect) refreshWorkerUi();
  });

  sectionButtons.forEach((button) => {
    button.addEventListener('click', () => setSection(button.dataset.formSection));
  });

  suggestionsHost.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-suggestion]');
    if (!chip) return;
    descriptionInput.value = chip.dataset.suggestion;
    clearFieldError('description');
    descriptionInput.focus();
  });

  root.querySelector('#set-now').addEventListener('click', () => {
    dateInput.value = todayISO();
    timeInput.value = nowTime();
    refreshDateSummary();
    dateDetails.open = false;
  });

  root.querySelector('#add-worker-inline').addEventListener('click', () => {
    workerSheet({
      onSaved(worker) {
        workers.push(worker);
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = worker.name;
        workerSelect.appendChild(option);
        workerSelect.value = worker.id;
        typeSelect.value = 'Salary';
        refreshWorkerUi();
        showToast(`${worker.name} added.`, { tone: 'success' });
      }
    });
  });

  root.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const details = [
      existing.description,
      `${formatPKR(existing.amount)} · ${formatDate(existing.date, 'medium')}`,
      SECTIONS[existing.section].label
    ];
    const confirmed = await confirmDialog({
      title: 'Delete this expense?',
      message: 'This removes the record from your totals and worker history. This cannot be undone.',
      details,
      confirmText: 'Delete',
      cancelText: 'Keep it',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await deleteTransaction(existing.id);
      showToast('Expense deleted. Totals updated.', { tone: 'success' });
      window.location.hash = finalTarget(existing.section);
    } catch (error) {
      showFormError(error.message || 'The expense could not be deleted.');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAllErrors();

    const description = normalizeText(descriptionInput.value, 200);
    const amountResult = parseAmount(amountInput.value);
    const date = dateInput.value;
    const time = timeInput.value;
    const worker = currentSection === 'shop' ? currentWorker() : null;
    const paymentType = worker ? typeSelect.value : null;
    const note = normalizeText(noteInput.value, 500);

    let firstInvalid = null;

    if (!amountResult.ok) {
      setFieldError('amount', amountResult.error, '#expense-amount');
      firstInvalid = firstInvalid || '#expense-amount';
    }
    if (!description) {
      setFieldError('description', 'Enter what this expense was for.', '#expense-description');
      firstInvalid = firstInvalid || '#expense-description';
    }
    if (!validDateISO(date)) {
      setFieldError('date', 'Choose a valid date.', '#expense-date');
      firstInvalid = firstInvalid || '#expense-date';
    } else if (date > todayISO()) {
      setFieldError('date', 'The date cannot be in the future.', '#expense-date');
      firstInvalid = firstInvalid || '#expense-date';
    }
    if (!validTimeHHMM(time)) {
      setFieldError('date', 'Choose a valid time.', '#expense-time');
      firstInvalid = firstInvalid || '#expense-time';
    }
    if (worker && !PAYMENT_TYPES.some((type) => type.value === paymentType)) {
      setFieldError('worker', 'Choose a payment type.', '#expense-payment-type');
      firstInvalid = firstInvalid || '#expense-payment-type';
    }

    if (firstInvalid) {
      if (firstInvalid === '#expense-date' || firstInvalid === '#expense-time') dateDetails.open = true;
      if (firstInvalid === '#expense-payment-type') {
        const workerDetails = root.querySelector('#worker-details');
        if (workerDetails) workerDetails.open = true;
      }
      root.querySelector(firstInvalid)?.focus();
      return;
    }

    const direction = paymentType === 'Repayment' ? 'in' : 'out';

    const record = {
      id: editing ? existing.id : undefined,
      section: currentSection,
      direction,
      description,
      amount: amountResult.value,
      date,
      time,
      category: editing ? existing.category : null,
      note: note || null,
      workerId: worker ? worker.id : null,
      workerName: worker ? worker.name : null,
      paymentType: worker ? paymentType : null,
      createdAt: editing ? existing.createdAt : undefined,
      updatedAt: undefined
    };

    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';

    try {
      await saveTransaction(record);
      const message = direction === 'in'
        ? 'Repayment recorded. It is not counted as spending.'
        : editing
          ? 'Changes saved. Totals updated.'
          : `${SECTIONS[currentSection].label} expense saved.`;
      showToast(message, { tone: 'success' });
      window.location.hash = finalTarget(currentSection);
    } catch (error) {
      saveButton.disabled = false;
      refreshWorkerUi();
      showFormError(error.message || 'The expense could not be saved. Your earlier records were not changed.');
    }
  });

  refreshWorkerUi();
  refreshDateSummary();
  refreshNoteSummary();

  window.setTimeout(() => {
    if (!editing) amountInput.focus({ preventScroll: true });
  }, 180);
}
