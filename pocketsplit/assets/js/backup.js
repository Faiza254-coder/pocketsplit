/*
 * PocketSplit — backup format, validation, and file helpers.
 *
 * Format 1 (JSON):
 * {
 *   "app": "pocketsplit",
 *   "format": 1,
 *   "appVersion": "1.0.0",
 *   "exportedAt": "2026-10-20T09:30:00.000Z",
 *   "currency": "PKR",
 *   "summary": { ... },
 *   "checksum": "fnv1a:xxxxxxxx",
 *   "data": { "workers": [...], "transactions": [...] },
 *   "meta": { "installedAt": "..." }
 * }
 *
 * Validation rejects anything that could corrupt the books. It never
 * accepts a backup with broken worker links, missing required fields,
 * duplicate IDs, or a failed checksum.
 */

import {
  APP_VERSION, CURRENCY, PAYMENT_TYPES, SECTIONS, escapeHTML,
  normalizeText, nowTimestamp, parseAmount, sortTransactionsDesc,
  totals, validDateISO, validTimeHHMM, validTimestamp
} from './utils.js';

export const BACKUP_APP = 'pocketsplit';
export const BACKUP_FORMAT = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const MAX_BACKUP_WORKERS = 5000;
export const MAX_BACKUP_TRANSACTIONS = 100000;

const VALID_DIRECTIONS = new Set(['in', 'out']);
const KNOWN_PAYMENT_TYPES = new Set(PAYMENT_TYPES.map((type) => type.value));

export function checksumOf(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function plainWorker(worker) {
  return {
    id: worker.id,
    name: worker.name,
    createdAt: worker.createdAt || nowTimestamp(),
    updatedAt: worker.updatedAt || worker.createdAt || nowTimestamp()
  };
}

function plainTransaction(tx) {
  return {
    id: tx.id,
    section: tx.section,
    direction: tx.direction === 'in' ? 'in' : 'out',
    description: tx.description,
    amount: tx.amount,
    date: tx.date,
    time: tx.time,
    category: tx.category || null,
    note: tx.note || null,
    workerId: tx.workerId || null,
    workerName: tx.workerName || null,
    paymentType: tx.paymentType || null,
    createdAt: tx.createdAt || nowTimestamp(),
    updatedAt: tx.updatedAt || nowTimestamp()
  };
}

export function buildBackup({ workers = [], transactions = [], meta = {} } = {}) {
  const data = {
    workers: [...workers]
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'en', { sensitivity: 'base' }))
      .map(plainWorker),
    transactions: sortTransactionsDesc(transactions).map(plainTransaction)
  };

  const out = data.transactions.filter((tx) => tx.direction !== 'in');
  const summary = totals(out);
  const payload = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    appVersion: APP_VERSION,
    exportedAt: nowTimestamp(),
    currency: CURRENCY,
    summary: {
      workers: data.workers.length,
      transactions: data.transactions.length,
      shopExpenses: summary.shop,
      homeExpenses: summary.home,
      totalExpenses: summary.total,
      repayments: summary.repayment,
      oldestDate: data.transactions.length ? data.transactions[data.transactions.length - 1].date : null,
      newestDate: data.transactions.length ? data.transactions[0].date : null
    },
    checksum: checksumOf(data),
    data,
    meta: {
      installedAt: meta.installedAt || null
    }
  };
  return payload;
}

function pushCapped(list, message, cap = 20) {
  if (list.length < cap) list.push(message);
  else if (list.length === cap) list.push('…and more problems were found.');
}

function readString(value) {
  return typeof value === 'string' ? value : '';
}

export function validateBackup(raw) {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['The file does not contain a PocketSplit backup object.'], warnings, data: null };
  }
  if (String(raw.app || '').toLowerCase() !== BACKUP_APP) {
    return { ok: false, errors: ['This is not a PocketSplit backup file. Choose a file named “PocketSplit-backup-…json”.'], warnings, data: null };
  }
  if (raw.format !== BACKUP_FORMAT) {
    const format = Number(raw.format);
    if (format > BACKUP_FORMAT) {
      errors.push('This backup was created by a newer version of PocketSplit. Update the app before restoring it.');
    } else {
      errors.push(`Unsupported backup format (${escapeHTML(String(raw.format))}). Expected format ${BACKUP_FORMAT}.`);
    }
    return { ok: false, errors, warnings, data: null };
  }
  if (!raw.data || typeof raw.data !== 'object' || !Array.isArray(raw.data.workers) || !Array.isArray(raw.data.transactions)) {
    return { ok: false, errors: ['The backup is missing its worker or transaction list, so it cannot be restored.'], warnings, data: null };
  }

  const rawWorkers = raw.data.workers;
  const rawTransactions = raw.data.transactions;

  if (rawWorkers.length > MAX_BACKUP_WORKERS) {
    errors.push(`The backup contains too many worker records (${rawWorkers.length.toLocaleString('en-US')}).`);
  }
  if (rawTransactions.length > MAX_BACKUP_TRANSACTIONS) {
    errors.push(`The backup contains too many transactions (${rawTransactions.length.toLocaleString('en-US')}).`);
  }
  if (errors.length) return { ok: false, errors, warnings, data: null };

  // Optional checksum: if present it must match, which catches truncated or edited files.
  if (raw.checksum) {
    const actual = checksumOf(raw.data);
    if (actual !== raw.checksum) {
      return {
        ok: false,
        errors: ['The backup file failed its integrity check. It may have been edited, corrupted, or only partly downloaded. Export a fresh backup from PocketSplit and try again.'],
        warnings,
        data: null
      };
    }
  } else {
    warnings.push('This backup has no integrity checksum. It will be validated field by field.');
  }

  const workers = [];
  const workerIds = new Set();
  const workerNames = new Map();

  rawWorkers.forEach((worker, index) => {
    const label = `Worker record ${index + 1}`;
    if (!worker || typeof worker !== 'object' || Array.isArray(worker)) {
      pushCapped(errors, `${label} is not a valid object.`);
      return;
    }
    const id = readString(worker.id).trim();
    const name = normalizeText(readString(worker.name), 80);
    if (!id) {
      pushCapped(errors, `${label} has no ID.`);
      return;
    }
    if (workerIds.has(id)) {
      pushCapped(errors, `${label} repeats an ID used by another worker (“${escapeHTML(name) || 'unnamed'}”).`);
      return;
    }
    if (!name) {
      pushCapped(errors, `${label} has no name.`);
      return;
    }
    if (name.length < 2) {
      pushCapped(errors, `${label} has a name that is too short.`);
      return;
    }
    const createdAt = validTimestamp(worker.createdAt) ? worker.createdAt : nowTimestamp();
    if (!validTimestamp(worker.createdAt)) {
      warnings.push(`Worker “${escapeHTML(name)}” had no valid creation date; today’s date was used.`);
    }
    const record = {
      id,
      name,
      nameLower: name.toLowerCase(),
      createdAt,
      updatedAt: validTimestamp(worker.updatedAt) ? worker.updatedAt : createdAt
    };
    workerIds.add(id);
    workerNames.set(id, name);
    workers.push(record);
  });

  const transactions = [];
  const transactionIds = new Set();
  const referencedWorkerIds = new Set();

  rawTransactions.forEach((tx, index) => {
    const label = `Transaction ${index + 1}`;
    if (!tx || typeof tx !== 'object' || Array.isArray(tx)) {
      pushCapped(errors, `${label} is not a valid object.`);
      return;
    }

    const id = readString(tx.id).trim();
    if (!id) {
      pushCapped(errors, `${label} has no ID.`);
      return;
    }
    if (transactionIds.has(id)) {
      pushCapped(errors, `${label} repeats an ID. Duplicate records would double-count spending.`);
      return;
    }

    const section = readString(tx.section).toLowerCase();
    if (!SECTIONS[section]) {
      pushCapped(errors, `${label} has an invalid section (must be “shop” or “home”).`);
      return;
    }

    const description = normalizeText(readString(tx.description), 200);
    if (!description) {
      pushCapped(errors, `${label} has no description.`);
      return;
    }

    let amountValue = tx.amount;
    if (typeof amountValue === 'string') amountValue = amountValue.replace(/,/g, '').trim();
    const amountResult = parseAmount(amountValue, { allowZero: true });
    if (!amountResult.ok) {
      pushCapped(errors, `${label} (“${escapeHTML(description)}”) has an invalid amount: ${escapeHTML(amountResult.error)}`);
      return;
    }
    if (amountResult.value === 0) {
      warnings.push(`${label} (“${escapeHTML(description)}”) has a zero amount. It will be restored as recorded.`);
    }

    if (!validDateISO(tx.date)) {
      pushCapped(errors, `${label} (“${escapeHTML(description)}”) has an invalid date.`);
      return;
    }
    if (!validTimeHHMM(tx.time)) {
      pushCapped(errors, `${label} (“${escapeHTML(description)}”) has an invalid time.`);
      return;
    }

    let direction = readString(tx.direction).toLowerCase();
    if (!VALID_DIRECTIONS.has(direction)) direction = 'out';
    let paymentType = readString(tx.paymentType).trim() || null;

    if (paymentType && !KNOWN_PAYMENT_TYPES.has(paymentType)) {
      warnings.push(`${label} uses an unrecognised payment type “${escapeHTML(paymentType)}”; it was kept as a custom label.`);
    }
    if (paymentType === 'Repayment' && direction === 'out') {
      direction = 'in';
      warnings.push(`${label} was marked as a repayment but also as an outgoing payment; it was restored as a repayment received.`);
    }
    if (direction === 'in' && paymentType !== 'Repayment') {
      paymentType = 'Repayment';
      warnings.push(`${label} is money received, so its type was restored as “Repayment”.`);
    }

    let workerId = tx.workerId ? readString(tx.workerId).trim() : null;
    if (workerId) {
      if (!workerIds.has(workerId)) {
        pushCapped(errors, `${label} (“${escapeHTML(description)}”) refers to a worker who is missing from this backup. Restoring it would break worker totals.`);
        return;
      }
      referencedWorkerIds.add(workerId);
    } else {
      workerId = null;
    }

    if (direction === 'in' && !workerId) {
      pushCapped(errors, `${label} is a repayment but is not linked to a worker.`);
      return;
    }

    const workerName = workerId ? (workerNames.get(workerId) || null) : (readString(tx.workerName).trim() || null);
    if (!workerId && paymentType) {
      warnings.push(`${label} has a worker payment type but no worker link; the type was cleared and it was kept as a normal expense.`);
      paymentType = null;
    }

    const createdAt = validTimestamp(tx.createdAt) ? tx.createdAt : `${tx.date}T${tx.time}:00`;
    const updatedAt = validTimestamp(tx.updatedAt) ? tx.updatedAt : createdAt;

    transactionIds.add(id);
    transactions.push({
      id,
      section,
      direction,
      description,
      amount: amountResult.value,
      date: tx.date,
      time: tx.time,
      category: typeof tx.category === 'string' ? normalizeText(tx.category, 60) || null : null,
      note: typeof tx.note === 'string' ? normalizeText(tx.note, 500) || null : null,
      workerId,
      workerName,
      paymentType,
      createdAt,
      updatedAt
    });
  });

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      data: null,
      summary: null
    };
  }

  const normalizedData = { workers, transactions };
  const out = transactions.filter((tx) => tx.direction !== 'in');
  const computed = totals(out);
  const summary = {
    workers: workers.length,
    transactions: transactions.length,
    shopExpenses: computed.shop,
    homeExpenses: computed.home,
    totalExpenses: computed.total,
    repayments: computed.repayment,
    linkedPayments: transactions.filter((tx) => tx.workerId).length
  };

  if (raw.summary && typeof raw.summary === 'object') {
    const declaredTotal = Number(raw.summary.totalExpenses);
    if (Number.isFinite(declaredTotal) && Math.abs(declaredTotal - summary.totalExpenses) > 0.009) {
      warnings.push('The summary printed inside the file does not match its records. The records themselves are valid and were used for the preview below.');
    }
    if (Number(raw.summary.workers) !== summary.workers || Number(raw.summary.transactions) !== summary.transactions) {
      warnings.push('The record counts printed inside the file do not match its contents. The records themselves are valid.');
    }
  }

  if (referencedWorkerIds.size !== workers.length) {
    const unused = workers.filter((worker) => !referencedWorkerIds.has(worker.id));
    warnings.push(`${unused.length} worker ${unused.length === 1 ? 'record has' : 'records have'} no payment history in this backup.`);
  }

  return {
    ok: true,
    errors: [],
    warnings: warnings.slice(0, 12),
    data: normalizedData,
    summary,
    exportedAt: validTimestamp(raw.exportedAt) ? raw.exportedAt : null,
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : null,
    totalExpensesPaisa: computed.outPaisa
  };
}

export function readBackupFile(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ ok: false, errors: ['No file was selected.'], warnings: [] });
      return;
    }
    if (file.size > MAX_BACKUP_BYTES) {
      resolve({
        ok: false,
        errors: [`That file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. PocketSplit backups should be well under 20 MB. Check that you chose the right file.`],
        warnings: []
      });
      return;
    }
    if (!/\.json$/i.test(file.name || '') && file.type && !/json/i.test(file.type)) {
      resolve({
        ok: false,
        errors: ['Choose a PocketSplit JSON backup file. Other file types are not supported.'],
        warnings: []
      });
      return;
    }

    const handleText = (text) => {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        resolve({
          ok: false,
          errors: ['This file is not valid JSON, so it cannot be restored. It may be corrupted or only partly downloaded.'],
          warnings: []
        });
        return;
      }
      const result = validateBackup(parsed);
      resolve({ ...result, fileName: file.name, fileSize: file.size });
    };

    if (typeof file.text === 'function') {
      file.text().then(handleText).catch(() => {
        resolve({ ok: false, errors: ['The file could not be read. Try choosing it again from the Files app.'], warnings: [] });
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result || ''));
    reader.onerror = () => resolve({ ok: false, errors: ['The file could not be read. Try choosing it again from the Files app.'], warnings: [] });
    reader.readAsText(file);
  });
}

export function describeBackupResult(result) {
  if (!result || !result.ok || !result.summary) {
    return { text: 'Backup not valid', tone: 'error' };
  }
  return {
    text: `${result.summary.transactions.toLocaleString('en-US')} transactions · ${result.summary.workers.toLocaleString('en-US')} workers`,
    tone: 'success'
  };
}

export function backupAmountLabel(result) {
  if (!result || !result.summary) return '—';
  return `PKR ${result.summary.totalExpenses.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
