/*
 * PocketSplit — local database layer (IndexedDB).
 *
 * Stores:
 *   transactions  keyPath id, indexes by-date, by-section, by-worker
 *   workers       keyPath id, index by-name
 *   meta          keyPath key (installedAt, lastBackupAt, lastRestoreAt, ...)
 *
 * Nothing here talks to a network. All financial records stay on this device.
 */

import {
  DB_NAME, SECTIONS, nowTimestamp, sortTransactionsDesc,
  uid, validDateISO, validTimeHHMM, normalizeText
} from './utils.js';

export const WORKER_IN_USE = 'WORKER_IN_USE';
export const DUPLICATE_WORKER = 'DUPLICATE_WORKER';
export const INVALID_RECORD = 'INVALID_RECORD';
export const DB_UNAVAILABLE = 'DB_UNAVAILABLE';
export const DB_WRITE_FAILED = 'DB_WRITE_FAILED';

export class DatabaseError extends Error {
  constructor(message, code = 'DB_ERROR', cause = null) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.cause = cause;
  }
}

let dbPromise = null;
let openError = null;

const DB_VERSION = 1;

function friendlyIDBError(error) {
  if (!error) return 'The local database reported an unknown error.';
  switch (error.name) {
    case 'QuotaExceededError':
      return 'The iPhone is out of storage space. Free some space in Settings, then try saving again.';
    case 'ConstraintError':
      return 'That record conflicts with an existing one. Reload the app and try again.';
    case 'InvalidStateError':
      return 'The local database is busy. Close other PocketSplit tabs and try again.';
    case 'UnknownError':
      return 'Safari could not write to local storage. If you are in Private Browsing, close it and open PocketSplit normally.';
    case 'VersionError':
      return 'The local database was created by a newer version of PocketSplit. Update the app, then try again.';
    case 'NotAllowedError':
      return 'Safari blocked local storage. Check Settings → Safari for this website and allow website data.';
    default:
      return 'The local database could not complete the request. Your existing records were not changed.';
  }
}

export function openDatabase() {
  if (dbPromise) return dbPromise;
  openError = null;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      openError = new DatabaseError(
        'This browser does not support IndexedDB, which PocketSplit needs to store records on the device. Open PocketSplit in Safari on the iPhone.',
        DB_UNAVAILABLE
      );
      reject(openError);
      return;
    }

    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      openError = new DatabaseError(friendlyIDBError(error), DB_UNAVAILABLE, error);
      reject(openError);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'id' });
        store.createIndex('by-date', 'date', { unique: false });
        store.createIndex('by-section', 'section', { unique: false });
        store.createIndex('by-worker', 'workerId', { unique: false });
      }
      if (!db.objectStoreNames.contains('workers')) {
        const store = db.createObjectStore('workers', { keyPath: 'id' });
        store.createIndex('by-name', 'nameLower', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      openError = new DatabaseError(
        `PocketSplit could not open its local database. ${friendlyIDBError(request.error)}`,
        DB_UNAVAILABLE,
        request.error
      );
      dbPromise = null;
      reject(openError);
    };

    request.onblocked = () => {
      console.warn('PocketSplit database upgrade blocked by another open tab.');
    };
  });

  return dbPromise;
}

export function getOpenError() {
  return openError;
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(storeName, mode);
    } catch (error) {
      reject(new DatabaseError(friendlyIDBError(error), DB_WRITE_FAILED, error));
      return;
    }

    let result;
    let actionError = null;
    const store = tx.objectStore(storeName);

    try {
      const value = action(store);
      if (value && typeof value.then === 'function') {
        value.then((resolved) => { result = resolved; }).catch((error) => {
          actionError = error;
          try { tx.abort(); } catch (abortError) { /* already finished */ }
        });
      } else {
        result = value;
      }
    } catch (error) {
      actionError = error;
      try { tx.abort(); } catch (abortError) { /* already finished */ }
    }

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => {
      if (actionError) {
        reject(actionError instanceof DatabaseError
          ? actionError
          : new DatabaseError(actionError.message || friendlyIDBError(tx.error), DB_WRITE_FAILED, tx.error));
      } else {
        reject(new DatabaseError(friendlyIDBError(tx.error), DB_WRITE_FAILED, tx.error));
      }
    };
    tx.onabort = () => {
      if (actionError) {
        reject(actionError instanceof DatabaseError
          ? actionError
          : new DatabaseError(actionError.message || friendlyIDBError(tx.error), DB_WRITE_FAILED, tx.error));
      } else {
        reject(new DatabaseError(friendlyIDBError(tx.error), DB_WRITE_FAILED, tx.error));
      }
    };
  });
}

/* ------------------------------------------------------------------ */
/* Init & meta                                                        */
/* ------------------------------------------------------------------ */

export async function initDatabase() {
  const db = await openDatabase();

  await new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction('meta', 'readwrite');
    } catch (error) {
      reject(new DatabaseError(friendlyIDBError(error), DB_UNAVAILABLE, error));
      return;
    }
    const store = tx.objectStore('meta');
    const getRequest = store.get('installedAt');
    getRequest.onsuccess = () => {
      if (!getRequest.result) {
        store.put({ key: 'installedAt', value: nowTimestamp() });
      }
      const schema = store.get('schemaVersion');
      schema.onsuccess = () => {
        if (!schema.result) store.put({ key: 'schemaVersion', value: DB_VERSION });
      };
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new DatabaseError(friendlyIDBError(tx.error), DB_UNAVAILABLE, tx.error));
    tx.onabort = () => reject(new DatabaseError(friendlyIDBError(tx.error), DB_UNAVAILABLE, tx.error));
  });

  return db;
}

export async function getMeta(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly');
    const request = tx.objectStore('meta').get(key);
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => reject(new DatabaseError(friendlyIDBError(request.error), DB_UNAVAILABLE, request.error));
  });
}

export async function setMeta(key, value) {
  return withStore('meta', 'readwrite', (store) => {
    store.put({ key, value });
    return value;
  });
}

export async function getAllMeta() {
  const rows = await withStore('meta', 'readonly', (store) => requestAsPromise(store.getAll()));
  const meta = {};
  (rows || []).forEach((row) => { if (row && row.key) meta[row.key] = row.value; });
  return meta;
}

/* ------------------------------------------------------------------ */
/* Transactions                                                       */
/* ------------------------------------------------------------------ */

function normalizeTransaction(input) {
  const now = nowTimestamp();
  const record = {
    id: typeof input.id === 'string' && input.id ? input.id : uid(),
    section: input.section,
    direction: input.direction === 'in' ? 'in' : 'out',
    description: normalizeText(input.description, 200),
    amount: Math.round(Number(input.amount) * 100) / 100,
    date: input.date,
    time: input.time,
    category: input.category ? normalizeText(input.category, 60) : null,
    note: input.note ? normalizeText(input.note, 500) : null,
    workerId: input.workerId || null,
    workerName: input.workerName ? normalizeText(input.workerName, 80) : null,
    paymentType: input.paymentType ? normalizeText(input.paymentType, 40) : null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };

  if (!SECTIONS[record.section]) {
    throw new DatabaseError('Choose Shop or Home for this expense.', INVALID_RECORD);
  }
  if (!record.description) {
    throw new DatabaseError('Enter a description before saving.', INVALID_RECORD);
  }
  if (!Number.isFinite(record.amount) || record.amount <= 0) {
    throw new DatabaseError('Enter an amount greater than zero.', INVALID_RECORD);
  }
  if (!validDateISO(record.date)) {
    throw new DatabaseError('The date is not valid.', INVALID_RECORD);
  }
  if (!validTimeHHMM(record.time)) {
    throw new DatabaseError('The time is not valid.', INVALID_RECORD);
  }
  if (record.direction === 'in' && !record.workerId) {
    throw new DatabaseError('A repayment must be linked to a worker.', INVALID_RECORD);
  }

  return record;
}

export async function saveTransaction(input) {
  const record = normalizeTransaction(input);
  await withStore('transactions', 'readwrite', (store) => {
    store.put(record);
    return record;
  });
  return record;
}

export async function deleteTransaction(id) {
  if (!id) throw new DatabaseError('No transaction was selected.', INVALID_RECORD);
  await withStore('transactions', 'readwrite', (store) => {
    store.delete(id);
    return true;
  });
  return true;
}

export async function getAllTransactions() {
  const rows = await withStore('transactions', 'readonly', (store) => requestAsPromise(store.getAll()));
  return sortTransactionsDesc(rows || []);
}

export async function getTransaction(id) {
  if (!id) return null;
  return withStore('transactions', 'readonly', (store) => requestAsPromise(store.get(id)));
}

export async function getTransactionsByWorker(workerId) {
  if (!workerId) return [];
  const rows = await withStore('transactions', 'readonly', (store) => {
    const index = store.index('by-worker');
    return requestAsPromise(index.getAll(workerId));
  });
  return sortTransactionsDesc(rows || []);
}

/* ------------------------------------------------------------------ */
/* Workers                                                            */
/* ------------------------------------------------------------------ */

function normalizeWorker(input, existing = null) {
  const now = nowTimestamp();
  const name = normalizeText(input.name, 80);
  if (!name) throw new DatabaseError('Enter the worker’s name.', INVALID_RECORD);
  if (name.length < 2) throw new DatabaseError('The name must be at least 2 characters.', INVALID_RECORD);
  return {
    id: (existing && existing.id) || input.id || uid(),
    name,
    nameLower: name.toLowerCase(),
    createdAt: (existing && existing.createdAt) || input.createdAt || now,
    updatedAt: now
  };
}

export async function getAllWorkers() {
  const rows = await withStore('workers', 'readonly', (store) => requestAsPromise(store.getAll()));
  return (rows || []).sort((a, b) => String(a.name).localeCompare(String(b.name), 'en', { sensitivity: 'base' }));
}

export async function getWorker(id) {
  if (!id) return null;
  return withStore('workers', 'readonly', (store) => requestAsPromise(store.get(id)));
}

export async function saveWorker(input) {
  const existing = await getWorker(input.id);
  const record = normalizeWorker(input, existing);
  const workers = await getAllWorkers();
  const duplicate = workers.find((worker) => worker.nameLower === record.nameLower && worker.id !== record.id);
  if (duplicate) {
    throw new DatabaseError(`A worker named “${record.name}” already exists.`, DUPLICATE_WORKER);
  }
  if (existing && existing.name !== record.name) {
    // Keep the worker-name snapshot on existing transactions in sync.
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(['workers', 'transactions'], 'readwrite');
      } catch (error) {
        reject(new DatabaseError(friendlyIDBError(error), DB_WRITE_FAILED, error));
        return;
      }
      tx.objectStore('workers').put(record);
      const index = tx.objectStore('transactions').index('by-worker');
      const cursorRequest = index.openCursor(record.id);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const value = cursor.value;
        value.workerName = record.name;
        value.updatedAt = nowTimestamp();
        cursor.update(value);
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new DatabaseError(friendlyIDBError(tx.error), DB_WRITE_FAILED, tx.error));
      tx.onabort = () => reject(new DatabaseError(friendlyIDBError(tx.error), DB_WRITE_FAILED, tx.error));
    });
  } else {
    await withStore('workers', 'readwrite', (store) => {
      store.put(record);
      return record;
    });
  }
  return record;
}

export async function getWorkerTransactionCount(workerId) {
  const txns = await getTransactionsByWorker(workerId);
  return txns.length;
}

export async function deleteWorker(id) {
  if (!id) throw new DatabaseError('No worker was selected.', INVALID_RECORD);
  const txns = await getTransactionsByWorker(id);
  if (txns.length > 0) {
    throw new DatabaseError(
      `This worker has ${txns.length} payment ${txns.length === 1 ? 'record' : 'records'}. Delete or reassign those payments first, so your totals stay accurate.`,
      WORKER_IN_USE
    );
  }
  await withStore('workers', 'readwrite', (store) => {
    store.delete(id);
    return true;
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* Backup / restore (atomic writes)                                   */
/* ------------------------------------------------------------------ */

export async function getBackupData() {
  const [workers, transactions, meta] = await Promise.all([
    getAllWorkers(),
    getAllTransactions(),
    getAllMeta()
  ]);
  return { workers, transactions, meta };
}

/**
 * Restore validated records. Mode "replace" wipes current data first;
 * mode "merge" keeps existing records and skips transactions whose IDs
 * already exist (which prevents a re-imported backup from double-counting).
 * The whole write runs in one transaction, so a failure changes nothing.
 */
export async function restoreData({ workers, transactions, mode = 'merge' }) {
  const db = await openDatabase();
  const existingWorkers = await getAllWorkers();
  const existingTransactions = await getAllTransactions();

  const existingWorkerIds = new Set(existingWorkers.map((w) => w.id));
  const existingTxIds = new Set(existingTransactions.map((t) => t.id));

  const finalWorkers = [];
  const finalTransactions = [];

  if (mode === 'replace') {
    finalWorkers.push(...workers);
    finalTransactions.push(...transactions);
  } else {
    workers.forEach((worker) => {
      if (!existingWorkerIds.has(worker.id)) {
        finalWorkers.push(worker);
        existingWorkerIds.add(worker.id);
      }
    });
    transactions.forEach((tx) => {
      if (existingTxIds.has(tx.id)) return;
      finalTransactions.push(tx);
      existingTxIds.add(tx.id);
    });
  }

  await new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(['workers', 'transactions'], 'readwrite');
    } catch (error) {
      reject(new DatabaseError(friendlyIDBError(error), DB_WRITE_FAILED, error));
      return;
    }
    const workersStore = tx.objectStore('workers');
    const txStore = tx.objectStore('transactions');

    if (mode === 'replace') {
      workersStore.clear();
      txStore.clear();
    }
    finalWorkers.forEach((worker) => workersStore.put(worker));
    finalTransactions.forEach((record) => txStore.put(record));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new DatabaseError(friendlyIDBError(tx.error), DB_WRITE_FAILED, tx.error));
    tx.onabort = () => reject(new DatabaseError(friendlyIDBError(tx.error), DB_WRITE_FAILED, tx.error));
  });

  return {
    mode,
    workersAdded: finalWorkers.length,
    transactionsAdded: finalTransactions.length,
    transactionsSkipped: mode === 'merge' ? transactions.length - finalTransactions.length : 0,
    workersSkipped: mode === 'merge' ? workers.length - finalWorkers.length : 0
  };
}

export async function clearEverything() {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(['workers', 'transactions'], 'readwrite');
    } catch (error) {
      reject(new DatabaseError(friendlyIDBError(error), DB_WRITE_FAILED, error));
      return;
    }
    tx.objectStore('workers').clear();
    tx.objectStore('transactions').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new DatabaseError(friendlyIDBError(tx.error), DB_WRITE_FAILED, tx.error));
    tx.onabort = () => reject(new DatabaseError(friendlyIDBError(tx.error), DB_WRITE_FAILED, tx.error));
  });
  await Promise.all([
    setMeta('lastBackupAt', null),
    setMeta('lastBackupTransactionCount', 0),
    setMeta('lastRestoreAt', null)
  ]);
  return true;
}

/* ------------------------------------------------------------------ */
/* Stats                                                              */
/* ------------------------------------------------------------------ */

export async function getDataStats() {
  const [workers, transactions, meta] = await Promise.all([
    getAllWorkers(), getAllTransactions(), getAllMeta()
  ]);
  const out = transactions.filter((tx) => tx.direction !== 'in');
  const dates = transactions.map((tx) => tx.date).filter(validDateISO).sort();
  const workerIds = new Set(workers.map((w) => w.id));
  const linked = transactions.filter((tx) => tx.workerId && workerIds.has(tx.workerId)).length;
  return {
    workers: workers.length,
    transactions: transactions.length,
    expenses: out.length,
    repayments: transactions.length - out.length,
    shopTransactions: transactions.filter((tx) => tx.section === 'shop').length,
    homeTransactions: transactions.filter((tx) => tx.section === 'home').length,
    oldestDate: dates[0] || null,
    newestDate: dates[dates.length - 1] || null,
    linkedPayments: linked,
    meta
  };
}

export async function requestPersistentStorage() {
  if (!navigator.storage || typeof navigator.storage.persist !== 'function') return null;
  try {
    if (typeof navigator.storage.persisted === 'function') {
      const already = await navigator.storage.persisted();
      if (already) return true;
    }
    return await navigator.storage.persist();
  } catch (error) {
    return false;
  }
}

export async function getPersistenceStatus() {
  if (!navigator.storage || typeof navigator.storage.persisted !== 'function') return null;
  try { return await navigator.storage.persisted(); } catch (error) { return null; }
}
