/*
 * Worker management: list, add/rename, and per-worker payment ledgers.
 * A repayment is money received from the worker; it reduces net paid but is
 * never counted as shop spending.
 */

import {
  PAYMENT_TYPES, addDaysISO, currentMonthKey, dateToISO, filterTransactions,
  formatDate, formatPKR, formatRange, normalizeText, nowTime, pluralize,
  shiftMonth, sumPaisa, todayISO, totals, validDateISO, escapeHTML
} from '../utils.js';
import {
  avatar, backButton, emptyState, icon, iconButton, openSheet, showToast,
  transactionGroups, confirmDialog, alertBox
} from '../components.js';
import {
  deleteWorker, getAllTransactions, getAllWorkers, getTransactionsByWorker,
  getWorker, saveWorker
} from '../db.js';

function safeDateFromTimestamp(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return dateToISO(date);
}

function paidTotals(list) {
  const out = list.filter((tx) => tx.direction !== 'in');
  const incoming = list.filter((tx) => tx.direction === 'in');
  const paidPaisa = sumPaisa(out);
  const repaidPaisa = sumPaisa(incoming);
  return {
    paidPaisa,
    repaidPaisa,
    netPaisa: paidPaisa - repaidPaisa,
    paid: paidPaisa / 100,
    repaid: repaidPaisa / 100,
    net: (paidPaisa - repaidPaisa) / 100,
    count: out.length,
    repaymentCount: incoming.length
  };
}

function netLabel(amount) {
  if (amount < 0) return `− ${formatPKR(Math.abs(amount))}`;
  return formatPKR(amount);
}

function workerMonthStats(transactions, workerId) {
  const { start, end } = { start: `${currentMonthKey()}-01`, end: addDaysISO(todayISO(), 0) };
  const list = filterTransactions(transactions, { workerId, start, end });
  return paidTotals(list);
}

/* ------------------------------------------------------------------ */
/* Add / edit worker sheet                                            */
/* ------------------------------------------------------------------ */

function openWorkerEditor({ worker = null, transactionCount = 0, onDone }) {
  const isEdit = Boolean(worker);
  const layer = openSheet({
    title: isEdit ? 'Edit worker' : 'Add worker',
    content: `
      <form class="sheet-form" id="worker-form" novalidate>
        <div class="field">
          <label class="field-label" for="worker-name">Worker’s name</label>
          <input class="input" id="worker-name" name="name" type="text" dir="auto" maxlength="80" autocomplete="off" placeholder="e.g. Ali Raza" value="${escapeHTML(worker ? worker.name : '')}" data-autofocus>
          <p class="field-error" data-error></p>
        </div>
        <p class="worker-sheet-note">A name is enough. Payments are linked to this worker, so their salary history and totals stay together.</p>
        <div class="form-actions-row">
          <button class="btn btn-secondary" type="button" data-layer-close>Cancel</button>
          <button class="btn btn-primary" type="submit">${isEdit ? 'Save name' : 'Add worker'}</button>
        </div>
      </form>
      ${isEdit ? `
        <div class="divider"></div>
        ${transactionCount > 0
          ? `<p class="worker-sheet-note">${pluralize(transactionCount, 'payment record')} use this worker, so the worker cannot be deleted. Delete or reassign those payments first.</p>`
          : `<button class="btn btn-danger-soft btn-block btn-sm" type="button" data-remove-worker>Remove worker</button>`}
      ` : ''}`,
    onMount(sheet, close) {
      const form = sheet.querySelector('#worker-form');
      const input = sheet.querySelector('#worker-name');
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
        submit.textContent = 'Saving…';
        try {
          const saved = await saveWorker({ id: worker ? worker.id : undefined, name });
          close({ type: isEdit ? 'updated' : 'added', worker: saved });
        } catch (err) {
          field.classList.add('has-error');
          error.textContent = err.message || 'The worker could not be saved.';
          submit.disabled = false;
          submit.textContent = isEdit ? 'Save name' : 'Add worker';
        }
      });

      sheet.querySelector('[data-remove-worker]')?.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: `Remove ${worker.name}?`,
          message: 'This worker has no payment records. Removing them only deletes the name from your worker list.',
          confirmText: 'Remove',
          cancelText: 'Keep worker',
          tone: 'danger'
        });
        if (!confirmed) return;
        try {
          await deleteWorker(worker.id);
          close({ type: 'deleted', worker });
        } catch (err) {
          field.classList.add('has-error');
          error.textContent = err.message || 'The worker could not be removed.';
        }
      });
    }
  });

  layer.onClose = (result) => {
    if (!result) return;
    if (result.type === 'added') showToast(`${result.worker.name} added.`, { tone: 'success' });
    if (result.type === 'updated') showToast('Worker name updated. Payment history updated too.', { tone: 'success' });
    if (result.type === 'deleted') showToast(`${result.worker.name} removed.`, { tone: 'success' });
    if (typeof onDone === 'function') onDone(result);
  };
}

/* ------------------------------------------------------------------ */
/* Workers list                                                       */
/* ------------------------------------------------------------------ */

export async function runWorkers(root, params) {
  const [workers, transactions] = await Promise.all([
    getAllWorkers(),
    getAllTransactions()
  ]);

  const monthTx = filterTransactions(transactions, {
    start: `${currentMonthKey()}-01`,
    end: addDaysISO(todayISO(), 0)
  });
  const monthTotals = totals(monthTx);

  root.innerHTML = `
    <div class="page-top">
      ${backButton('#/shop', 'Back to shop')}
      <div class="page-top-actions">
        ${iconButton({ icon: 'plus', label: 'Add worker', attrs: 'data-add-worker' })}
      </div>
    </div>

    <header class="page-heading">
      <div class="page-heading-main">
        <p class="eyebrow">Shop · People</p>
        <h1 class="page-title">Workers</h1>
        <p class="page-sub">Salaries, advances, extra payments and repayments — each kept separate and easy to trace.</p>
      </div>
    </header>

    <div class="workers-overview">
      <div class="overview-stat"><span>Workers</span><strong>${workers.length}</strong></div>
      <div class="overview-stat"><span>Paid this month</span><strong>${escapeHTML(formatPKR(monthTotals.worker))}</strong></div>
      <div class="overview-stat"><span>Repaid</span><strong>${escapeHTML(formatPKR(monthTotals.repayment))}</strong></div>
    </div>

    <button class="btn btn-secondary btn-block" type="button" data-add-worker>
      ${icon('plus', 18)}Add worker
    </button>

    <div class="list-head">
      <h2>All workers</h2>
      <span>${workers.length === 1 ? '1 person' : `${workers.length} people`}</span>
    </div>

    ${workers.length ? `<div class="worker-list">
      ${workers.map((worker) => {
        const list = filterTransactions(transactions, { workerId: worker.id });
        const stats = paidTotals(list);
        const monthStats = workerMonthStats(transactions, worker.id);
        const joined = safeDateFromTimestamp(worker.createdAt);
        return `<a class="worker-card" href="#/workers/${encodeURIComponent(worker.id)}">
          ${avatar(worker.name, { size: 44, id: worker.id })}
          <span class="worker-card-main">
            <span class="worker-card-name">${escapeHTML(worker.name)}</span>
            <span class="worker-card-meta">${stats.count || stats.repaymentCount
              ? `${stats.count ? pluralize(stats.count, 'payment') : 'No payments'}${stats.repaymentCount ? ` · ${stats.repaymentCount} repaid` : ''}`
              : 'No payments yet'}${joined ? ` · added ${escapeHTML(formatDate(joined, 'short'))}` : ''}</span>
          </span>
          <span class="worker-card-amount">
            <strong>${monthStats.paid > 0 ? escapeHTML(formatPKR(monthStats.paid)) : '—'}</strong>
            <span>this month</span>
          </span>
          ${icon('chevron-right', 15, 'chev')}
        </a>`;
      }).join('')}
    </div>` : emptyState({
      icon: 'users',
      title: 'No workers yet',
      text: 'Add each worker once. Then every salary, advance, extra payment or repayment can be linked to the right person.',
      actionLabel: 'Add your first worker',
      actionHref: '#/workers?add=1'
    })}

    <div class="data-footnote">
      ${icon('info', 14)}
      <span>Advances are treated as payments, not loans. Record a repayment only when the worker actually returns money. Repayments are separate from shop spending.</span>
    </div>
    <div class="page-end"></div>
  `;

  const addButtons = root.querySelectorAll('[data-add-worker]');
  const openAdd = () => {
    openWorkerEditor({
      onDone: async (result) => {
        if (result.type === 'deleted') return;
        await runWorkers(root, new URLSearchParams());
      }
    });
  };
  addButtons.forEach((button) => button.addEventListener('click', openAdd));

  if (params.get('add') === '1' && workers.length >= 0) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/workers`);
    window.setTimeout(openAdd, 180);
  }
}

/* ------------------------------------------------------------------ */
/* Worker detail                                                      */
/* ------------------------------------------------------------------ */

function workerRangeState(params) {
  const today = todayISO();
  let range = params.get('range');
  if (!['month', 'lastmonth', 'all', 'custom'].includes(range)) range = 'month';
  const month = `${currentMonthKey()}-01`;
  let start = validDateISO(params.get('start')) ? params.get('start') : month;
  let end = validDateISO(params.get('end')) ? params.get('end') : today;
  if (range === 'lastmonth') {
    const previous = monthRangeFor(shiftMonth(currentMonthKey(), -1));
    start = previous.start;
    end = previous.end;
  }
  if (range === 'month') {
    start = month;
    end = today;
  }
  return { range, start, end };
}

function monthRangeFor(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDay = new Date(year, month, 0, 12, 0, 0).getDate();
  return { start: `${monthKey}-01`, end: `${monthKey}-${String(lastDay).padStart(2, '0')}` };
}

function rangeLabelFor(state) {
  if (state.range === 'month') return 'This month';
  if (state.range === 'lastmonth') return 'Last month';
  if (state.range === 'all') return 'All time';
  return formatRange(state.start, state.end);
}

function rangeQuery(state) {
  const query = new URLSearchParams({ range: state.range });
  if (state.range === 'custom') {
    query.set('start', state.start);
    query.set('end', state.end);
  }
  return query.toString();
}

export async function runWorkerDetail(root, params, id) {
  const [worker, allTransactions] = await Promise.all([
    getWorker(id),
    getAllTransactions()
  ]);

  if (!worker) {
    root.innerHTML = `
      <div class="page-top">${backButton('#/workers', 'Back to workers')}</div>
      <div class="mt-20">
        ${emptyState({
          icon: 'alert',
          title: 'Worker not found',
          text: 'This worker may have been removed. Their old payment records, if any, are still in your transaction history.',
          actionLabel: 'Back to workers',
          actionHref: '#/workers'
        })}
      </div>`;
    return;
  }

  const state = workerRangeState(params);
  const workerTransactions = await getTransactionsByWorker(worker.id);
  const rangeTransactions = filterTransactions(workerTransactions, {
    workerId: worker.id,
    start: state.range === 'all' ? null : state.start,
    end: state.range === 'all' ? null : state.end
  });
  const stats = paidTotals(rangeTransactions);
  const allStats = paidTotals(workerTransactions);
  const joined = safeDateFromTimestamp(worker.createdAt);
  const fromToken = `worker:${worker.id}?${rangeQuery(state)}`;
  const addParams = new URLSearchParams({
    section: 'shop',
    worker: worker.id,
    type: 'Salary',
    from: fromToken
  });
  const quickParams = (type) => new URLSearchParams({
    section: 'shop',
    worker: worker.id,
    type,
    from: fromToken
  }).toString();

  root.innerHTML = `
    <div class="page-top">
      ${backButton('#/workers', 'Back to workers')}
      <div class="page-top-actions">
        ${iconButton({ icon: 'edit', label: 'Edit worker name', attrs: 'data-edit-worker' })}
      </div>
    </div>

    <header class="page-heading">
      <div class="page-heading-main">
        <p class="eyebrow">Worker ledger</p>
        <h1 class="page-title">${escapeHTML(worker.name)}</h1>
        <p class="page-sub">Every payment linked to this worker, with a clear separation between money paid and money returned.</p>
      </div>
    </header>

    <div class="profile-card">
      ${avatar(worker.name, { size: 54, id: worker.id })}
      <div class="profile-main">
        <p class="profile-name">${escapeHTML(worker.name)}</p>
        <p class="profile-meta">${allStats.count ? pluralize(allStats.count, 'payment') : 'No payments yet'}${joined ? ` · added ${escapeHTML(formatDate(joined, 'medium'))}` : ''}</p>
      </div>
    </div>

    <div class="mt-16">
      <div class="range-chips" role="group" aria-label="Payment history date range">
        <button type="button" class="range-chip ${state.range === 'month' ? 'is-active' : ''}" data-worker-range="month">This month</button>
        <button type="button" class="range-chip ${state.range === 'lastmonth' ? 'is-active' : ''}" data-worker-range="lastmonth">Last month</button>
        <button type="button" class="range-chip ${state.range === 'all' ? 'is-active' : ''}" data-worker-range="all">All time</button>
        <button type="button" class="range-chip ${state.range === 'custom' ? 'is-active' : ''}" data-worker-range="custom">Custom</button>
      </div>
      <div class="custom-range" id="worker-custom-range" ${state.range === 'custom' ? '' : 'hidden'}>
        <input class="input" type="date" id="worker-range-start" value="${escapeHTML(state.start)}" max="${todayISO()}" aria-label="From date">
        <input class="input" type="date" id="worker-range-end" value="${escapeHTML(state.end)}" max="${todayISO()}" aria-label="To date">
        <button class="btn btn-secondary btn-sm" type="button" data-apply-worker-range style="grid-column:1/-1">Apply dates</button>
        <p class="field-error" data-worker-range-error style="display:none;grid-column:1/-1"></p>
      </div>
    </div>

    <div class="worker-stats">
      <div class="worker-stat"><span>Paid</span><strong>${escapeHTML(formatPKR(stats.paid))}</strong></div>
      <div class="worker-stat in"><span>Repaid</span><strong>${escapeHTML(formatPKR(stats.repaid))}</strong></div>
      <div class="worker-stat"><span>Net paid</span><strong>${escapeHTML(netLabel(stats.net))}</strong></div>
    </div>
    <p class="amount-explainer">${escapeHTML(rangeLabelFor(state))}: net paid = payments out − repayments received. An advance is not treated as a loan unless the worker returns money and you record a repayment.</p>

    <a class="btn btn-primary btn-block" href="#/add?${escapeHTML(addParams.toString())}">
      ${icon('plus', 19)}Record a payment
    </a>
    <div class="payment-quick-row" aria-label="Quick payment types">
      <a class="payment-quick" href="#/add?${escapeHTML(quickParams('Salary'))}">Salary</a>
      <a class="payment-quick" href="#/add?${escapeHTML(quickParams('Advance'))}">Advance</a>
      <a class="payment-quick" href="#/add?${escapeHTML(quickParams('Additional Payment'))}">Additional</a>
      <a class="payment-quick" href="#/add?${escapeHTML(quickParams('Repayment'))}">${icon('arrow-down-left', 12)}Repayment</a>
    </div>

    <div class="list-head">
      <h2>Payment history</h2>
      <span>${escapeHTML(rangeLabelFor(state))}</span>
    </div>

    ${rangeTransactions.length
      ? `<div class="range-label-row">
          <strong>${stats.count === 1 ? '1 payment' : `${stats.count} payments`}${stats.repaymentCount ? ` · ${stats.repaymentCount} repayment${stats.repaymentCount === 1 ? '' : 's'}` : ''}</strong>
          <span>${escapeHTML(rangeLabelFor(state))}</span>
        </div>
        ${transactionGroups(rangeTransactions, { showSection: false, from: fromToken })}`
      : emptyState({
          icon: 'wallet',
          title: state.range === 'all' ? 'No payments yet' : 'No payments in this period',
          text: state.range === 'all'
            ? 'Record a salary, advance or additional payment. It will appear here with its date, type and note.'
            : 'Try All time, or record a new payment for this worker.',
          actionLabel: 'Record a payment',
          actionHref: `#/add?${escapeHTML(addParams.toString())}`
        })}

    ${allStats.repaymentCount ? `<div class="alert alert-info mt-16">
      <span class="alert-icon">${icon('info', 18)}</span>
      <div class="alert-body"><strong>About repayments</strong><p>${escapeHTML(formatPKR(allStats.repaid))} has been recorded as returned by ${escapeHTML(worker.name)} across all time. Repayments reduce net paid but are never counted as shop spending.</p></div>
    </div>` : ''}

    <div class="data-footnote">
      ${icon('lock', 14)}
      <span>This ledger is built from saved payment records linked to this worker’s ID. Editing a payment updates these totals immediately.</span>
    </div>
    <div class="page-end"></div>
  `;

  const editButton = root.querySelector('[data-edit-worker]');
  editButton?.addEventListener('click', () => {
    openWorkerEditor({
      worker,
      transactionCount: workerTransactions.length,
      onDone: async (result) => {
        if (result.type === 'deleted') {
          window.location.hash = '#/workers';
          return;
        }
        await runWorkerDetail(root, new URLSearchParams(rangeQuery(state)), worker.id);
      }
    });
  });

  root.querySelectorAll('[data-worker-range]').forEach((button) => {
    button.addEventListener('click', async () => {
      const range = button.dataset.workerRange;
      if (range === 'custom') {
        const next = new URLSearchParams({
          range: 'custom',
          start: state.range === 'custom' ? state.start : `${currentMonthKey()}-01`,
          end: state.range === 'custom' ? state.end : todayISO()
        });
        await runWorkerDetail(root, next, worker.id);
        return;
      }
      const next = new URLSearchParams({ range });
      await runWorkerDetail(root, next, worker.id);
    });
  });

  root.querySelector('[data-apply-worker-range]')?.addEventListener('click', async () => {
    const start = root.querySelector('#worker-range-start').value;
    const end = root.querySelector('#worker-range-end').value;
    const error = root.querySelector('[data-worker-range-error]');
    if (!validDateISO(start) || !validDateISO(end)) {
      error.textContent = 'Choose both dates.';
      error.style.display = 'block';
      return;
    }
    if (start > end) {
      error.textContent = 'The start date must be before the end date.';
      error.style.display = 'block';
      return;
    }
    if (end > todayISO()) {
      error.textContent = 'The end date cannot be in the future.';
      error.style.display = 'block';
      return;
    }
    await runWorkerDetail(root, new URLSearchParams({ range: 'custom', start, end }), worker.id);
  });
}
