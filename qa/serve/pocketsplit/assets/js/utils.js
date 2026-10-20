/*
 * PocketSplit — shared utilities.
 * Money is handled in integer paisa (1 PKR = 100 paisa) for exact totals.
 * Dates are stored as local-time strings: "YYYY-MM-DD" + "HH:MM".
 */

export const APP_VERSION = '1.0.0';
export const CURRENCY = 'PKR';
export const DB_NAME = 'pocketsplit';
export const MAX_AMOUNT = 999999999.99;

export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const PAYMENT_TYPES = [
  { value: 'Salary', label: 'Salary', direction: 'out', help: 'Regular monthly salary paid to the worker.' },
  { value: 'Advance', label: 'Advance', direction: 'out', help: 'Money given early. Record a repayment separately if it is returned.' },
  { value: 'Additional Payment', label: 'Additional payment', direction: 'out', help: 'Any extra payment: overtime, bonus, lunch money, etc.' },
  { value: 'Repayment', label: 'Repayment received', direction: 'in', help: 'Money the worker returned. This is not counted as spending; it reduces the net paid.' }
];

export const SECTIONS = {
  shop: { key: 'shop', label: 'Shop', title: 'Shop expenses', icon: 'store', className: 'shop' },
  home: { key: 'home', label: 'Home', title: 'Home expenses', icon: 'home', className: 'home' }
};

/* ------------------------------------------------------------------ */
/* Money                                                              */
/* ------------------------------------------------------------------ */

export function toPaisa(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromPaisa(paisa) {
  return Math.round(paisa) / 100;
}

export function sumPaisa(list, key = 'amount') {
  return (list || []).reduce((total, item) => {
    if (!item) return total;
    return total + toPaisa(item[key]);
  }, 0);
}

export function sumAmount(list, key = 'amount') {
  return fromPaisa(sumPaisa(list, key));
}

export function formatPKR(amount, options = {}) {
  const { showCurrency = true, maxDecimals = 2, minDecimals = 0 } = options;
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  const hasFraction = Math.abs(safe % 1) > 0.0000001;
  const digits = hasFraction ? Math.max(2, minDecimals) : minDecimals;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Math.min(digits, maxDecimals),
    maximumFractionDigits: maxDecimals
  }).format(safe);
  return showCurrency ? `${CURRENCY} ${formatted}` : formatted;
}

export function formatAmountInput(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function formatSignedPKR(tx) {
  const sign = tx && tx.direction === 'in' ? '+' : '−';
  return `${sign} ${formatPKR(tx ? tx.amount : 0)}`;
}

/**
 * Parse an amount typed by the user. Accepts "5000", "5,000", " 5000.50 ".
 * Rejects negatives, zero (unless allowZero), more than 2 decimals, and values
 * that are not plain decimal numbers.
 */
export function parseAmount(raw, options = {}) {
  const { allowZero = false } = options;
  const original = String(raw == null ? '' : raw).trim();
  if (!original) return { ok: false, value: null, error: 'Enter an amount.' };

  const cleaned = original.replace(/,/g, '').replace(/\s+/g, '').replace(/^(pkr|rs\.?)/i, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return { ok: false, value: null, error: 'Use numbers only, for example 1250 or 1250.50.' };
  }
  const decimals = cleaned.split('.')[1];
  if (decimals && decimals.length > 2) {
    return { ok: false, value: null, error: 'Use at most two decimal places.' };
  }
  const value = Math.round(Number(cleaned) * 100) / 100;
  if (!Number.isFinite(value)) {
    return { ok: false, value: null, error: 'Enter a valid amount.' };
  }
  if (value <= 0 && !allowZero) {
    return { ok: false, value: null, error: 'Amount must be greater than zero.' };
  }
  if (value > MAX_AMOUNT) {
    return { ok: false, value: null, error: `Amount cannot be more than ${formatPKR(MAX_AMOUNT)}.` };
  }
  return { ok: true, value, error: null };
}

export function percent(part, total) {
  const p = Number(part);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.min(100, (p / t) * 100));
}

/* ------------------------------------------------------------------ */
/* Dates & times (always local time)                                  */
/* ------------------------------------------------------------------ */

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function dateToISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayISO() {
  return dateToISO(new Date());
}

export function nowTime() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function nowTimestamp() {
  return new Date().toISOString();
}

export function validDateISO(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function validTimeHHMM(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function validTimestamp(value) {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

export function dateFromISO(iso) {
  if (!validDateISO(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function formatDate(iso, style = 'medium') {
  const date = dateFromISO(iso);
  if (!date) return '—';
  const d = date.getDate();
  const mShort = MONTHS_SHORT[date.getMonth()];
  const mLong = MONTHS_LONG[date.getMonth()];
  const y = date.getFullYear();
  const wd = WEEKDAYS_LONG[date.getDay()];
  if (style === 'medium') return `${d} ${mShort} ${y}`;
  if (style === 'short') return `${d} ${mShort}`;
  if (style === 'long') return `${d} ${mLong} ${y}`;
  if (style === 'weekday') return `${wd}, ${d} ${mShort} ${y}`;
  if (style === 'weekday-short') return `${wd.slice(0, 3)}, ${d} ${mShort}`;
  if (style === 'day') return String(d);
  return `${d} ${mShort} ${y}`;
}

export function formatTime(hhmm) {
  if (!validTimeHHMM(hhmm)) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(m)} ${suffix}`;
}

export function formatTimestamp(iso) {
  if (!validTimestamp(iso)) return '—';
  const date = new Date(iso);
  return `${formatDate(dateToISO(date))} · ${formatTime(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`)}`;
}

export function relativeDayLabel(iso) {
  if (!validDateISO(iso)) return '—';
  const today = todayISO();
  if (iso === today) return 'Today';
  const yesterday = addDaysISO(today, -1);
  if (iso === yesterday) return 'Yesterday';
  const date = dateFromISO(iso);
  const todayDate = dateFromISO(today);
  const sameYear = date.getFullYear() === todayDate.getFullYear();
  return sameYear ? formatDate(iso, 'weekday-short') : formatDate(iso, 'weekday');
}

export function addDaysISO(iso, days) {
  const date = dateFromISO(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + days);
  return dateToISO(date);
}

export function daysBetweenISO(start, end) {
  const a = dateFromISO(start);
  const b = dateFromISO(end);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function eachDayISO(start, end) {
  const days = [];
  if (!validDateISO(start) || !validDateISO(end) || start > end) return days;
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 4000) {
    days.push(cursor);
    cursor = addDaysISO(cursor, 1);
    guard += 1;
  }
  return days;
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function validMonthKey(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 2000;
}

export function monthLabel(monthKey, style = 'long') {
  if (!validMonthKey(monthKey)) return '—';
  const [y, m] = monthKey.split('-').map(Number);
  return style === 'short' ? `${MONTHS_SHORT[m - 1]} ${y}` : `${MONTHS_LONG[m - 1]} ${y}`;
}

export function shiftMonth(monthKey, delta) {
  if (!validMonthKey(monthKey)) return currentMonthKey();
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1, 12, 0, 0);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function monthRange(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = new Date(y, m, 0, 12, 0, 0).getDate();
  return { start: `${monthKey}-01`, end: `${monthKey}-${pad2(lastDay)}` };
}

export function monthKeyFromDate(iso) {
  return validDateISO(iso) ? iso.slice(0, 7) : currentMonthKey();
}

export function monthOptions(count = 48) {
  const current = currentMonthKey();
  const options = [];
  for (let i = 0; i < count; i += 1) options.push(shiftMonth(current, -i));
  return options;
}

export function compareDateTime(a, b) {
  const left = `${a.date}T${a.time}`;
  const right = `${b.date}T${b.time}`;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function sortTransactionsDesc(list) {
  return [...(list || [])].sort((a, b) => {
    const byDateTime = compareDateTime(b, a);
    if (byDateTime !== 0) return byDateTime;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

export function inRange(iso, start, end) {
  if (!validDateISO(iso)) return false;
  if (start && iso < start) return false;
  if (end && iso > end) return false;
  return true;
}

export function taxTimestampFor(dateISO, timeHHMM) {
  const stamp = validTimestamp(`${dateISO}T${timeHHMM}:00`);
  return stamp ? `${dateISO}T${timeHHMM}:00` : nowTimestamp();
}

export function formatRange(start, end) {
  if (!validDateISO(start) || !validDateISO(end)) return '—';
  if (start === end) return formatDate(start, 'medium');
  const startDate = dateFromISO(start);
  const endDate = dateFromISO(end);
  if (startDate.getFullYear() !== endDate.getFullYear()) {
    return `${formatDate(start, 'medium')} – ${formatDate(end, 'medium')}`;
  }
  if (startDate.getMonth() === endDate.getMonth()) {
    return `${formatDate(start, 'short')} – ${formatDate(end, 'medium')}`;
  }
  return `${formatDate(start, 'short')} – ${formatDate(end, 'medium')}`;
}

export function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Peaceful night';
  if (hour < 12) return 'Good morning';
  if (hour < 16) return 'Good afternoon';
  if (hour < 19) return 'Good evening';
  return 'Good evening';
}

/* ------------------------------------------------------------------ */
/* Filtering & grouping                                               */
/* ------------------------------------------------------------------ */

export function filterTransactions(list, filters = {}) {
  const {
    section = 'all', start = null, end = null, query = '',
    workerId = null, direction = null, paymentType = null
  } = filters;
  const q = String(query || '').trim().toLowerCase();

  return (list || []).filter((tx) => {
    if (section && section !== 'all' && tx.section !== section) return false;
    if (start && tx.date < start) return false;
    if (end && tx.date > end) return false;
    if (workerId && tx.workerId !== workerId) return false;
    if (direction && tx.direction !== direction) return false;
    if (paymentType && tx.paymentType !== paymentType) return false;
    if (q) {
      const haystack = [tx.description, tx.workerName, tx.note, tx.category, tx.paymentType]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function groupByDay(list) {
  const sorted = sortTransactionsDesc(list);
  const groups = [];
  const map = new Map();
  sorted.forEach((tx) => {
    if (!map.has(tx.date)) {
      const group = { date: tx.date, items: [], outPaisa: 0, inPaisa: 0 };
      map.set(tx.date, group);
      groups.push(group);
    }
    const group = map.get(tx.date);
    group.items.push(tx);
    if (tx.direction === 'in') group.inPaisa += toPaisa(tx.amount);
    else group.outPaisa += toPaisa(tx.amount);
  });
  return groups;
}

export function expensesOnly(list) {
  return (list || []).filter((tx) => tx.direction !== 'in');
}

export function groupByDescription(list) {
  const map = new Map();
  (list || []).forEach((tx) => {
    if (tx.direction === 'in') return;
    const key = String(tx.description || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { key, label: String(tx.description).trim(), paisa: 0, count: 0 });
    }
    const entry = map.get(key);
    entry.paisa += toPaisa(tx.amount);
    entry.count += 1;
  });
  return [...map.values()]
    .map((entry) => ({ ...entry, amount: fromPaisa(entry.paisa) }))
    .sort((a, b) => b.paisa - a.paisa);
}

export function totals(list) {
  const result = {
    shopPaisa: 0, homePaisa: 0, outPaisa: 0, inPaisa: 0,
    shopInPaisa: 0, homeInPaisa: 0,
    shopCount: 0, homeCount: 0, workerPaisa: 0, workerCount: 0,
    repaymentPaisa: 0, repaymentCount: 0
  };
  (list || []).forEach((tx) => {
    const p = toPaisa(tx.amount);
    if (tx.direction === 'in') {
      result.inPaisa += p;
      result.repaymentPaisa += p;
      result.repaymentCount += 1;
      if (tx.section === 'shop') result.shopInPaisa += p;
      if (tx.section === 'home') result.homeInPaisa += p;
      return;
    }
    result.outPaisa += p;
    if (tx.section === 'shop') {
      result.shopPaisa += p;
      result.shopCount += 1;
      if (tx.workerId) {
        result.workerPaisa += p;
        result.workerCount += 1;
      }
    } else if (tx.section === 'home') {
      result.homePaisa += p;
      result.homeCount += 1;
    }
  });
  result.shop = fromPaisa(result.shopPaisa);
  result.home = fromPaisa(result.homePaisa);
  result.out = fromPaisa(result.outPaisa);
  result.in = fromPaisa(result.inPaisa);
  result.worker = fromPaisa(result.workerPaisa);
  result.repayment = fromPaisa(result.repaymentPaisa);
  result.total = fromPaisa(result.shopPaisa + result.homePaisa);
  result.netWorker = fromPaisa(result.workerPaisa - result.inPaisa);
  return result;
}

export function dailySeries(list, start, end) {
  const days = eachDayISO(start, end);
  const map = new Map(days.map((d) => [d, { date: d, shopPaisa: 0, homePaisa: 0 }]));
  (list || []).forEach((tx) => {
    if (tx.direction === 'in') return;
    const entry = map.get(tx.date);
    if (!entry) return;
    if (tx.section === 'shop') entry.shopPaisa += toPaisa(tx.amount);
    else if (tx.section === 'home') entry.homePaisa += toPaisa(tx.amount);
  });
  return days.map((d) => {
    const entry = map.get(d);
    return {
      key: d,
      shop: fromPaisa(entry.shopPaisa),
      home: fromPaisa(entry.homePaisa),
      total: fromPaisa(entry.shopPaisa + entry.homePaisa),
      shopPaisa: entry.shopPaisa,
      homePaisa: entry.homePaisa
    };
  });
}

export function monthlySeries(list, start, end) {
  if (!validDateISO(start) || !validDateISO(end)) return [];
  const months = [];
  let cursor = start.slice(0, 7);
  const last = end.slice(0, 7);
  let guard = 0;
  while (cursor <= last && guard < 240) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
    guard += 1;
  }
  const map = new Map(months.map((m) => [m, { key: m, shopPaisa: 0, homePaisa: 0 }]));
  (list || []).forEach((tx) => {
    if (tx.direction === 'in') return;
    const entry = map.get(tx.date.slice(0, 7));
    if (!entry) return;
    if (tx.section === 'shop') entry.shopPaisa += toPaisa(tx.amount);
    else if (tx.section === 'home') entry.homePaisa += toPaisa(tx.amount);
  });
  return months.map((m) => {
    const entry = map.get(m);
    return {
      key: m,
      label: monthLabel(m, 'short'),
      shop: fromPaisa(entry.shopPaisa),
      home: fromPaisa(entry.homePaisa),
      total: fromPaisa(entry.shopPaisa + entry.homePaisa),
      shopPaisa: entry.shopPaisa,
      homePaisa: entry.homePaisa
    };
  });
}

export function previousRangeTotals(all, start, end) {
  const span = Math.max(1, daysBetweenISO(start, end) + 1);
  const prevEnd = addDaysISO(start, -1);
  const prevStart = addDaysISO(prevEnd, -(span - 1));
  return totals(filterTransactions(all, { start: prevStart, end: prevEnd }));
}

/* ------------------------------------------------------------------ */
/* Strings, DOM & misc                                                */
/* ------------------------------------------------------------------ */

export function escapeHTML(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const esc = escapeHTML;

export function normalizeText(value, max = 500) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

export function debounce(fn, wait = 220) {
  let timer = null;
  return function debounced(...args) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn.apply(this, args), wait);
  };
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function avatarTone(idOrName) {
  const value = String(idOrName || '');
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return ['sage', 'beige', 'olive', 'sand'][hash % 4];
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : (plural || `${singular}s`)}`;
}

export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return 'less than 1 KB';
  if (n < 1024) return `${Math.round(n)} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPercent(value, total) {
  const p = percent(value, total);
  if (p > 0 && p < 1) return '<1%';
  return `${Math.round(p)}%`;
}

export function downloadBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (error) {
    return false;
  }
}

export function isStandalone() {
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
}

export function isIOS() {
  const ua = window.navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function canShareFiles() {
  if (!navigator.share || !navigator.canShare) return false;
  try {
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    return navigator.canShare({ files: [file] });
  } catch (error) {
    return false;
  }
}

export function storageEstimate() {
  if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
  return navigator.storage.estimate().catch(() => null);
}

export function getSearchParams() {
  const hash = window.location.hash || '';
  const index = hash.indexOf('?');
  if (index === -1) return new URLSearchParams();
  return new URLSearchParams(hash.slice(index + 1));
}

export function formatBackupFilename(date = new Date()) {
  return `PocketSplit-backup-${dateToISO(date)}-${pad2(date.getHours())}${pad2(date.getMinutes())}.json`;
}

export function normalizeBackupMode(value) {
  return value === 'replace' ? 'replace' : 'merge';
}
