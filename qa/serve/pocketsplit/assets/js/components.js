/*
 * PocketSplit — shared UI components.
 * All user-supplied text must pass through esc() before being inserted as HTML.
 */

import {
  esc, formatPKR, formatTime, formatDate, relativeDayLabel, groupByDay,
  formatSignedPKR, fromPaisa, monthLabel, monthOptions, currentMonthKey,
  validMonthKey, initials, avatarTone, SECTIONS, PAYMENT_TYPES
} from './utils.js';

let layerCounter = 0;
const layers = [];
let keyListenerAttached = false;
let lastFocus = null;

/* ------------------------------------------------------------------ */
/* Icons & brand                                                      */
/* ------------------------------------------------------------------ */

export function icon(name, size = 20, className = '') {
  const safeName = String(name || '').replace(/[^a-z0-9-]/gi, '');
  return `<svg class="icon ${className}" width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="#i-${safeName}"></use></svg>`;
}

export function logoMark(size = 36, className = '') {
  return `<svg class="logo-mark ${className}" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="PocketSplit">
    <rect x="1" y="1" width="62" height="62" rx="19" fill="#123B2A"></rect>
    <path d="M32 15v34M15 32h34" stroke="#F8F2E4" stroke-width="9.5" stroke-linecap="round"></path>
    <path d="M40.5 12.5c7.4-2.9 13 2.7 10.1 10.1-7.4 2.9-13-2.7-10.1-10.1Z" fill="#A9C5A6"></path>
    <path d="M41.8 14.2c1.7 2.6 3.7 4.7 6.3 6.3" stroke="#123B2A" stroke-width="1.4" stroke-linecap="round" fill="none"></path>
  </svg>`;
}

export function wordmark() {
  return `<span class="wordmark">PocketSplit</span>`;
}

export function brandLockup({ href = '#/overview', small = false } = {}) {
  return `<a class="brand ${small ? 'brand-sm' : ''}" href="${esc(href)}" aria-label="PocketSplit home">
    ${logoMark(small ? 30 : 36)}
    ${wordmark()}
  </a>`;
}

/* ------------------------------------------------------------------ */
/* Shell pieces                                                       */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid', href: '#/overview' },
  { id: 'shop', label: 'Shop', icon: 'store', href: '#/shop' },
  { id: 'home', label: 'Home', icon: 'home', href: '#/home' },
  { id: 'reports', label: 'Reports', icon: 'chart', href: '#/reports' },
  { id: 'backup', label: 'Backup', icon: 'backup', href: '#/backup' }
];

export function tabbar(active = 'overview', visible = true) {
  return `<nav class="tabbar ${visible ? '' : 'tabbar-hidden'}" aria-label="Main">
    ${TABS.map((tab) => `
      <a class="tab ${tab.id === active ? 'is-active' : ''}" href="${tab.href}" ${tab.id === active ? 'aria-current="page"' : ''}>
        <span class="tab-icon">${icon(tab.icon, 22)}</span>
        <span class="tab-label">${tab.label}</span>
      </a>
    `).join('')}
  </nav>`;
}

export function backButton(href, label = 'Back', attrs = '') {
  return `<a class="icon-btn back-btn" href="${esc(href)}" aria-label="${esc(label)}" ${attrs}>${icon('chevron-left', 22)}</a>`;
}

export function pageTop({ backHref = null, backLabel = 'Back', actions = '', brand = false, backAttrs = '' } = {}) {
  return `<div class="page-top">
    ${backHref ? backButton(backHref, backLabel, backAttrs) : (brand ? brandLockup() : '<span class="top-spacer"></span>')}
    <div class="page-top-actions">${actions}</div>
  </div>`;
}

export function pageTitle({ eyebrow = '', title = '', subtitle = '', actions = '' }) {
  return `<header class="page-heading">
    <div class="page-heading-main">
      ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
      ${title ? `<h1 class="page-title">${title}</h1>` : ''}
      ${subtitle ? `<p class="page-sub">${subtitle}</p>` : ''}
    </div>
    ${actions ? `<div class="page-heading-actions">${actions}</div>` : ''}
  </header>`;
}

export function iconButton({ icon: iconName, label, href = null, attrs = '', variant = '', size = 20 }) {
  const cls = `icon-btn ${variant ? `icon-btn-${variant}` : ''}`;
  if (href) {
    return `<a class="${cls}" href="${esc(href)}" aria-label="${esc(label)}" title="${esc(label)}" ${attrs}>${icon(iconName, size)}</a>`;
  }
  return `<button class="${cls}" type="button" aria-label="${esc(label)}" title="${esc(label)}" ${attrs}>${icon(iconName, size)}</button>`;
}

export function sectionPill(section) {
  const meta = SECTIONS[section] || SECTIONS.shop;
  return `<span class="section-pill ${meta.className}">${icon(meta.icon, 12)}${meta.label}</span>`;
}

export function typePill(tx) {
  if (tx.direction === 'in') {
    return `<span class="type-pill in">${icon('arrow-down-left', 11)}Repayment</span>`;
  }
  if (tx.paymentType) {
    return `<span class="type-pill">${esc(tx.paymentType)}</span>`;
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* Month switcher & picker                                           */
/* ------------------------------------------------------------------ */

export function monthSwitcher(monthKey, { id = 'month-switch', label = 'Month' } = {}) {
  const isCurrent = monthKey >= currentMonthKey();
  return `<div class="month-switch" id="${esc(id)}" role="group" aria-label="${esc(label)}">
    <button class="month-arrow" type="button" data-month-prev aria-label="Previous month">${icon('chevron-left', 18)}</button>
    <button class="month-pill" type="button" data-month-open aria-haspopup="dialog" aria-label="Choose month, currently ${esc(monthLabel(monthKey))}">
      ${icon('calendar', 16)}
      <span data-month-label>${esc(monthLabel(monthKey))}</span>
      ${icon('chevron-down', 14, 'month-chev')}
    </button>
    <button class="month-arrow" type="button" data-month-next aria-label="Next month" ${isCurrent ? 'disabled' : ''}>${icon('chevron-right', 18)}</button>
  </div>`;
}

export function openMonthPicker(current = currentMonthKey(), { minYear = 2000 } = {}) {
  let year = Number((validMonthKey(current) ? current : currentMonthKey()).slice(0, 4));
  const selectedKey = validMonthKey(current) ? current : currentMonthKey();
  const nowKey = currentMonthKey();

  return new Promise((resolve) => {
    const layer = openSheet({
      title: 'Choose month',
      content: '<div data-year-picker></div>',
      onMount(sheet, close) {
        const host = sheet.querySelector('[data-year-picker]');
        const render = () => {
          const monthButtons = Array.from({ length: 12 }, (_, index) => {
            const key = `${year}-${String(index + 1).padStart(2, '0')}`;
            const disabled = key > nowKey || year < minYear;
            const classes = ['month-cell'];
            if (key === selectedKey) classes.push('is-selected');
            if (key === nowKey) classes.push('is-current');
            return `<button type="button" class="${classes.join(' ')}" data-month-value="${key}" ${disabled ? 'disabled' : ''}>
              ${monthLabel(key, 'short').split(' ')[0]}
              ${key === nowKey ? '<span class="month-dot" aria-hidden="true"></span>' : ''}
            </button>`;
          }).join('');
          host.innerHTML = `
            <div class="year-switch">
              <button class="icon-btn" type="button" data-year-prev aria-label="Previous year" ${year <= minYear ? 'disabled' : ''}>${icon('chevron-left', 20)}</button>
              <span class="year-label">${year}</span>
              <button class="icon-btn" type="button" data-year-next aria-label="Next year" ${year >= Number(nowKey.slice(0, 4)) ? 'disabled' : ''}>${icon('chevron-right', 20)}</button>
            </div>
            <div class="month-grid">${monthButtons}</div>
            <p class="sheet-hint">Current month: ${esc(monthLabel(nowKey))}</p>`;
        };
        render();

        host.addEventListener('click', (event) => {
          const monthBtn = event.target.closest('[data-month-value]');
          if (monthBtn) {
            resolve(monthBtn.dataset.monthValue);
            close();
            return;
          }
          if (event.target.closest('[data-year-prev]')) {
            year = Math.max(minYear, year - 1);
            render();
          } else if (event.target.closest('[data-year-next]')) {
            year = Math.min(Number(nowKey.slice(0, 4)), year + 1);
            render();
          }
        });
      }
    });
    layer.onClose = () => resolve(null);
  });
}

/* ------------------------------------------------------------------ */
/* Transactions                                                       */
/* ------------------------------------------------------------------ */

export function transactionRow(tx, { showSection = false, from = '', link = true, compact = false } = {}) {
  const meta = SECTIONS[tx.section] || SECTIONS.shop;
  const isIn = tx.direction === 'in';
  const detailBits = [];
  if (showSection) detailBits.push(`<span class="tx-section-dot ${meta.className}" aria-hidden="true"></span>${meta.label}`);
  if (tx.workerName) detailBits.push(esc(tx.workerName));
  if (tx.paymentType && tx.paymentType !== 'Repayment') detailBits.push(esc(tx.paymentType));
  if (tx.note) detailBits.push(`<span class="tx-note-preview">${esc(tx.note)}</span>`);
  if (!detailBits.length) detailBits.push(formatTime(tx.time));

  const inner = `
    <span class="tx-icon ${isIn ? 'in' : meta.className}">
      ${icon(isIn ? 'arrow-down-left' : (tx.workerId ? 'user' : meta.icon), 19)}
    </span>
    <span class="tx-main">
      <span class="tx-desc">${esc(tx.description)}</span>
      <span class="tx-meta">${detailBits.join('<span class="dot-sep">·</span>')}</span>
    </span>
    <span class="tx-amount-col">
      <span class="tx-amount ${isIn ? 'in' : 'out'}">${esc(formatSignedPKR(tx))}</span>
      <span class="tx-time">${esc(formatTime(tx.time))}</span>
    </span>`;

  if (!link) return `<div class="tx-row ${compact ? 'compact' : ''}" data-tx-id="${esc(tx.id)}">${inner}</div>`;
  const fromQuery = from ? `?from=${encodeURIComponent(from)}` : '';
  return `<a class="tx-row ${compact ? 'compact' : ''}" data-tx-id="${esc(tx.id)}" href="#/edit/${encodeURIComponent(tx.id)}${fromQuery}" aria-label="Edit ${esc(tx.description)}, ${esc(formatPKR(tx.amount))}">${inner}</a>`;
}

export function transactionGroups(list, { showSection = false, from = '', emptyText = 'No transactions here yet.' } = {}) {
  const groups = groupByDay(list);
  if (!groups.length) return `<p class="inline-empty">${esc(emptyText)}</p>`;
  return groups.map((group) => {
    const label = relativeDayLabel(group.date);
    const showDate = label === 'Today' || label === 'Yesterday';
    const inPaisa = group.items.reduce((total, tx) => total + (tx.direction === 'in' ? Math.round(tx.amount * 100) : 0), 0);
    return `<section class="tx-group" aria-label="${esc(formatDate(group.date, 'weekday'))}">
      <header class="tx-group-head">
        <div class="tx-group-date">
          <span class="tx-group-label">${esc(label)}</span>
          ${showDate ? `<span class="tx-group-full">${esc(formatDate(group.date, 'medium'))}</span>` : ''}
        </div>
        <div class="tx-group-total">
          <span class="muted-small">− ${esc(formatPKR(fromPaisa(group.outPaisa)))}</span>
          ${inPaisa > 0 ? `<span class="in-small">+ ${esc(formatPKR(fromPaisa(inPaisa)))}</span>` : ''}
        </div>
      </header>
      <div class="tx-list">
        ${group.items.map((tx) => transactionRow(tx, { showSection, from })).join('')}
      </div>
    </section>`;
  }).join('');
}

/* ------------------------------------------------------------------ */
/* Empty states & notes                                               */
/* ------------------------------------------------------------------ */

export function emptyState({ icon: iconName = 'receipt', title, text, actionLabel = '', actionHref = '', secondaryLabel = '', secondaryHref = '', tone = 'sage' }) {
  return `<div class="empty-state">
    <div class="empty-icon ${tone}">${icon(iconName, 26)}</div>
    <h2 class="empty-title">${esc(title)}</h2>
    <p class="empty-text">${esc(text)}</p>
    ${actionLabel && actionHref ? `<a class="btn btn-primary btn-block" href="${esc(actionHref)}">${icon('plus', 18)}${esc(actionLabel)}</a>` : ''}
    ${secondaryLabel && secondaryHref ? `<a class="btn btn-ghost btn-block" href="${esc(secondaryHref)}">${esc(secondaryLabel)}</a>` : ''}
  </div>`;
}

export function alertBox({ tone = 'info', title = '', text = '', html = '' }) {
  const iconName = tone === 'danger' ? 'alert' : tone === 'success' ? 'check' : tone === 'warn' ? 'alert' : 'info';
  return `<div class="alert alert-${esc(tone)}" role="${tone === 'danger' ? 'alert' : 'status'}">
    <span class="alert-icon">${icon(iconName, 18)}</span>
    <div class="alert-body">
      ${title ? `<strong>${esc(title)}</strong>` : ''}
      ${text ? `<p>${esc(text)}</p>` : ''}
      ${html || ''}
    </div>
  </div>`;
}

export function privacyNote() {
  return `<div class="privacy-note">
    <span class="privacy-note-icon">${icon('lock', 16)}</span>
    <p>Everything stays on this iPhone. PocketSplit has no account, no cloud, and no tracking.</p>
  </div>`;
}

export function disabledHint(text) {
  return `<p class="disabled-hint">${esc(text)}</p>`;
}

/* ------------------------------------------------------------------ */
/* Toasts                                                             */
/* ------------------------------------------------------------------ */

function ensureToastHost() {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  return host;
}

export function showToast(message, { tone = 'default', actionLabel = '', onAction = null, duration = 3600 } = {}) {
  const host = ensureToastHost();
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');

  const iconName = tone === 'success' ? 'check' : tone === 'error' ? 'alert' : tone === 'info' ? 'info' : 'spark';
  toast.innerHTML = `<span class="toast-icon">${icon(iconName, 18)}</span>
    <span class="toast-message">${esc(message)}</span>
    ${actionLabel ? `<button class="toast-action" type="button">${esc(actionLabel)}</button>` : ''}`;
  host.appendChild(toast);

  while (host.children.length > 3) host.firstElementChild.remove();

  let timer = null;
  const dismiss = () => {
    if (timer) window.clearTimeout(timer);
    toast.classList.add('toast-out');
    window.setTimeout(() => toast.remove(), 240);
  };
  const startTimer = () => {
    if (duration > 0) timer = window.setTimeout(dismiss, duration);
  };

  if (actionLabel) {
    toast.querySelector('.toast-action').addEventListener('click', () => {
      dismiss();
      if (typeof onAction === 'function') onAction();
    });
  }

  toast.addEventListener('pointerenter', () => { if (timer) window.clearTimeout(timer); });
  toast.addEventListener('pointerleave', startTimer);
  window.requestAnimationFrame(() => toast.classList.add('toast-in'));
  startTimer();
  return dismiss;
}

/* ------------------------------------------------------------------ */
/* Modal layers (confirm dialog + bottom sheet)                       */
/* ------------------------------------------------------------------ */

function ensureLayerHost() {
  let host = document.getElementById('layer-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'layer-host';
    document.body.appendChild(host);
  }
  return host;
}

function focusableIn(container) {
  return [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function handleGlobalKey(event) {
  const top = layers[layers.length - 1];
  if (!top) return;
  if (event.key === 'Escape' && top.dismissible) {
    event.preventDefault();
    top.close(top.sheetMode ? null : false);
    return;
  }
  if (event.key === 'Tab') {
    const focusables = focusableIn(top.element);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function syncBodyLock() {
  document.documentElement.classList.toggle('has-layer', layers.length > 0);
}

function createLayer({ className = '', html, dismissible = true, onClose = null }) {
  const host = ensureLayerHost();
  const wrapper = document.createElement('div');
  wrapper.className = `layer-backdrop ${className}`;
  wrapper.innerHTML = html;
  host.appendChild(wrapper);
  layerCounter += 1;
  const id = layerCounter;
  wrapper.dataset.layerId = String(id);

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const layer = {
    id,
    element: wrapper,
    dismissible,
    sheetMode: wrapper.classList.contains('sheet-backdrop'),
    onDismiss: null,
    onClose,
    closed: false,
    close(result) {
      if (layer.closed) return;
      layer.closed = true;
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      wrapper.classList.add('layer-out');
      window.setTimeout(() => wrapper.remove(), 220);
      syncBodyLock();
      if (!layers.length && previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus({ preventScroll: true });
      }
      if (typeof layer.onClose === 'function') layer.onClose(result);
    }
  };

  wrapper.querySelectorAll('[data-layer-close]').forEach((btn) => {
    btn.addEventListener('click', () => layer.close(layer.sheetMode ? null : false));
  });

  if (dismissible) {
    wrapper.addEventListener('click', (event) => {
      if (event.target === wrapper) layer.close(layer.sheetMode ? null : false);
    });
  }

  layers.push(layer);
  if (!keyListenerAttached) {
    document.addEventListener('keydown', handleGlobalKey);
    keyListenerAttached = true;
  }
  syncBodyLock();

  const dialog = wrapper.querySelector('[role="dialog"]');
  window.requestAnimationFrame(() => {
    wrapper.classList.add('layer-in');
    if (dialog) {
      const autofocus = dialog.querySelector('[data-autofocus]');
      if (autofocus) autofocus.focus({ preventScroll: true });
      else if (typeof dialog.focus === 'function') dialog.focus({ preventScroll: true });
    }
  });

  return layer;
}

export function confirmDialog({
  title, message = '', confirmText = 'Confirm', cancelText = 'Cancel',
  tone = 'default', note = '', details = []
}) {
  return new Promise((resolve) => {
    const toneIcon = tone === 'danger' ? 'trash' : tone === 'warn' ? 'alert' : 'info';
    const detailsHtml = details.length
      ? `<ul class="dialog-details">${details.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
      : '';
    const layer = createLayer({
      className: 'dialog-backdrop',
      dismissible: true,
      onClose: (result) => resolve(result === true),
      html: `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">
        <div class="dialog-icon ${tone}">${icon(toneIcon, 24)}</div>
        <h2 class="dialog-title" id="dialog-title">${esc(title)}</h2>
        ${message ? `<p class="dialog-message">${esc(message)}</p>` : ''}
        ${detailsHtml}
        ${note ? `<p class="dialog-note">${esc(note)}</p>` : ''}
        <div class="dialog-actions">
          <button class="btn btn-secondary" type="button" data-dialog-cancel>${esc(cancelText)}</button>
          <button class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" type="button" data-dialog-confirm data-autofocus>${esc(confirmText)}</button>
        </div>
      </div>`
    });
    const dialog = layer.element.querySelector('.dialog');
    dialog.querySelector('[data-dialog-cancel]').addEventListener('click', () => layer.close(false));
    dialog.querySelector('[data-dialog-confirm]').addEventListener('click', () => layer.close(true));
  });
}

export function openSheet({ title, content = '', footer = '', dismissible = true, onMount = null, className = '' }) {
  const layer = createLayer({
    className: `sheet-backdrop ${className}`,
    dismissible,
    html: `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-head">
        <h2 class="sheet-title" id="sheet-title">${esc(title)}</h2>
        <button class="icon-btn" type="button" aria-label="Close" data-layer-close>${icon('x', 20)}</button>
      </header>
      <div class="sheet-body">${content}</div>
      ${footer ? `<footer class="sheet-footer">${footer}</footer>` : ''}
    </div>`
  });
  const sheet = layer.element.querySelector('.sheet');
  if (typeof onMount === 'function') onMount(sheet, layer.close.bind(layer), layer);
  return layer;
}

export function closeAllLayers() {
  [...layers].forEach((layer) => layer.close(layer.sheetMode ? null : false));
}

export function hasOpenLayer() {
  return layers.length > 0;
}

/* ------------------------------------------------------------------ */
/* Misc                                                               */
/* ------------------------------------------------------------------ */

export function avatar(name, { size = 44, id = '' } = {}) {
  return `<span class="avatar avatar-${avatarTone(id || name)}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.34)}px" aria-hidden="true">${esc(initials(name))}</span>`;
}

export function loadMoreBar(remaining, id = 'load-more') {
  if (remaining <= 0) return '';
  return `<button class="btn btn-secondary btn-block load-more" type="button" id="${esc(id)}">Show more transactions <span class="count-pill">${remaining}</span></button>`;
}

export function paymentTypeOptions(selected = '') {
  return PAYMENT_TYPES.map((type) => `<option value="${esc(type.value)}" ${type.value === selected ? 'selected' : ''}>${esc(type.label)}</option>`).join('');
}

export function sectionSegment(active = 'shop', { name = 'section' } = {}) {
  return `<div class="segmented" role="group" aria-label="Expense section">
    <button type="button" class="segmented-item ${active === 'shop' ? 'is-active' : ''}" data-section-value="shop" aria-pressed="${active === 'shop'}">${icon('store', 17)}Shop</button>
    <button type="button" class="segmented-item ${active === 'home' ? 'is-active' : ''}" data-section-value="home" aria-pressed="${active === 'home'}">${icon('home', 17)}Home</button>
    <input type="hidden" name="${esc(name)}" value="${esc(active)}">
  </div>`;
}

export function monthShortLabel(monthKey) {
  return monthLabel(monthKey, 'short');
}
