/*
 * Backup & restore.
 * Exports are created on-device from IndexedDB. Nothing is uploaded.
 */

import {
  APP_VERSION, canShareFiles, currentMonthKey, downloadBlob, formatBackupFilename,
  formatDate, formatFileSize, formatPKR, formatTimestamp, fromPaisa,
  monthLabel, nowTimestamp, pluralize, storageEstimate, todayISO,
  escapeHTML
} from '../utils.js';
import {
  alertBox, brandLockup, confirmDialog, icon, iconButton, showToast
} from '../components.js';
import {
  clearEverything, getBackupData, getDataStats, getPersistenceStatus,
  restoreData, setMeta
} from '../db.js';
import { buildBackup, readBackupFile } from '../backup.js';

let lastRestoreResult = null;

function statusLine(meta, stats) {
  if (!stats.transactions && !stats.workers) {
    return { tone: 'warn', title: 'Nothing to back up yet', detail: 'Add your first expense, then export a copy.' };
  }
  if (!meta.lastBackupAt) {
    return { tone: 'warn', title: 'No backup yet', detail: 'Your records exist only on this iPhone until you export them.' };
  }
  return {
    tone: 'ok',
    title: `Last export ${formatTimestamp(meta.lastBackupAt)}`,
    detail: 'Confirm the file reached the Files app, iCloud Drive or another safe place.'
  };
}

function warningsMarkup(warnings) {
  if (!warnings || !warnings.length) return '';
  return alertBox({
    tone: 'warn',
    title: 'Read before restoring',
    html: `<ul>${warnings.map((warning) => `<li>${warning}</li>`).join('')}</ul>`
  });
}

function errorsMarkup(errors) {
  return alertBox({
    tone: 'danger',
    title: 'This file cannot be restored',
    html: `<ul>${errors.map((error) => `<li>${error}</li>`).join('')}</ul>`
  });
}

function restoreModeWarning(mode) {
  if (mode === 'replace') {
    return `<div class="alert alert-danger mt-12">
      <span class="alert-icon">${icon('alert', 18)}</span>
      <div class="alert-body"><strong>Replace mode deletes current records</strong><p>All transactions and workers on this iPhone will be erased before the backup is imported. Export a fresh backup first if you are unsure.</p></div>
    </div>`;
  }
  return `<div class="alert alert-info mt-12">
    <span class="alert-icon">${icon('info', 18)}</span>
    <div class="alert-body"><strong>Merge keeps what you have</strong><p>New records are added. Records whose IDs already exist are skipped, so re-importing the same file will not double-count spending.</p></div>
  </div>`;
}

async function render(root, params) {
  const [data, stats, persisted, estimate] = await Promise.all([
    getBackupData(),
    getDataStats(),
    getPersistenceStatus(),
    storageEstimate()
  ]);

  const meta = data.meta || {};
  const restoreNotice = lastRestoreResult;
  lastRestoreResult = null;
  const status = statusLine(meta, stats);
  const shareSupported = canShareFiles();
  const hasData = data.transactions.length > 0 || data.workers.length > 0;
  const usage = estimate && estimate.usage ? formatFileSize(estimate.usage) : null;
  const persistedLabel = persisted === true
    ? 'Persistent storage granted'
    : persisted === false
      ? 'Best-effort storage'
      : 'Not reported by this browser';

  root.innerHTML = `
    <div class="page-top">
      ${brandLockup()}
      <div class="page-top-actions">
        ${iconButton({ icon: 'more', label: 'About and help', href: '#/more' })}
      </div>
    </div>

    <header class="page-heading">
      <div class="page-heading-main">
        <p class="eyebrow">Data safety</p>
        <h1 class="page-title">Backup &amp; restore</h1>
        <p class="page-sub">Your records live on this iPhone. A backup is the only copy that can survive a lost, replaced or wiped phone.</p>
      </div>
    </header>

    <section class="backup-hero">
      <span class="backup-hero-icon">${icon('backup', 25)}</span>
      <div>
        <strong>Keep your ledger in your hands</strong>
        <p>One JSON file contains every transaction, worker, note and date. PocketSplit never uploads it anywhere.</p>
      </div>
    </section>

    <div class="backup-status">
      <span class="status-dot ${status.tone}"></span>
      <div class="backup-status-main">
        <strong>${escapeHTML(status.title)}</strong>
        <span>${escapeHTML(status.detail)}</span>
      </div>
      <span class="badge badge-offline">${icon('lock', 11)}Local only</span>
    </div>

    ${restoreNotice ? `<div class="alert alert-success mt-12">
      <span class="alert-icon">${icon('check', 18)}</span>
      <div class="alert-body">
        <strong>Restore complete</strong>
        <p>${escapeHTML(`${restoreNotice.transactionsAdded} transaction${restoreNotice.transactionsAdded === 1 ? '' : 's'} and ${restoreNotice.workersAdded} worker${restoreNotice.workersAdded === 1 ? '' : 's'} added.`)}${restoreNotice.transactionsSkipped ? ` ${restoreNotice.transactionsSkipped} duplicate transaction records were skipped.` : ''}</p>
      </div>
    </div>` : ''}

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>Export a backup</h2>
        <span>${hasData ? `${stats.transactions} records` : 'Empty'}</span>
      </div>
      <p class="page-sub">Creates a fresh file from the records currently saved on this device. Export after adding important payments.</p>

      <div class="backup-stats-grid">
        <div class="stat-box"><span>Transactions</span><strong>${stats.transactions}</strong></div>
        <div class="stat-box"><span>Workers</span><strong>${stats.workers}</strong></div>
        <div class="stat-box"><span>Oldest record</span><strong>${stats.oldestDate ? escapeHTML(formatDate(stats.oldestDate, 'medium')) : '—'}</strong></div>
        <div class="stat-box"><span>Local storage</span><strong>${escapeHTML(usage || '—')}</strong></div>
      </div>

      <div class="backup-actions">
        ${shareSupported
          ? `<button class="btn btn-primary btn-block" type="button" id="share-backup">${icon('share', 18)}Save or share backup</button>
             <button class="btn btn-secondary btn-block" type="button" id="download-backup">${icon('download', 18)}Download file instead</button>`
          : `<button class="btn btn-primary btn-block" type="button" id="download-backup">${icon('download', 18)}Download backup file</button>`}
      </div>

      <p class="report-note">On iPhone, the share sheet lets you choose <strong>Save to Files</strong>, iCloud Drive, email or another app. The download button places the file in the Files app’s Downloads folder. PocketSplit only counts the export after the browser accepts it — it cannot confirm where you saved it.</p>

      <div id="export-feedback"></div>
    </div>

    <div class="card report-cards" id="restore-card">
      <div class="report-card-head">
        <h2>Restore from a backup</h2>
        <span>JSON only</span>
      </div>
      <p class="page-sub">Import a PocketSplit backup file. Every record is checked before anything is written. Invalid or damaged files are rejected.</p>

      <input class="file-input-hidden" type="file" id="restore-file" accept=".json,application/json">
      <div class="backup-actions">
        <button class="btn btn-secondary btn-block" type="button" id="choose-backup">${icon('upload', 18)}Choose backup file</button>
      </div>
      <div id="restore-area" class="mt-12"></div>
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>Where your records live</h2>
        <span>No cloud</span>
      </div>
      <div class="data-list">
        <div class="data-line">${icon('phone', 15)}<span><strong>On this iPhone only.</strong> Transactions and workers are stored in Safari’s local database (IndexedDB). There is no account and no server copy.</span></div>
        <div class="data-line">${icon('shield', 15)}<span><strong>Home Screen apps keep separate storage.</strong> Data entered in a Safari tab is not shared with the installed PocketSplit icon. Choose one way of using the app and stay with it; use a backup file if you need to move data between them.</span></div>
        <div class="data-line">${icon('alert', 15)}<span><strong>Deleting the app or website data erases local records.</strong> Restoring a backup is the only way back. iOS may also remove website data if the device is erased or storage is cleared.</span></div>
        <div class="data-line">${icon('database', 15)}<span><strong>${escapeHTML(persistedLabel)}.</strong> ${usage ? `About ${escapeHTML(usage)} currently used.` : ''} PocketSplit asks Safari for persistent storage, but iOS ultimately controls this.</span></div>
      </div>
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>How to move a backup off the iPhone</h2>
        <span>Manual</span>
      </div>
      <div class="step-list">
        <div class="step-item"><p><strong>Create the backup</strong> using “Save or share backup”.</p></div>
        <div class="step-item"><p><strong>Choose Save to Files</strong> in the share sheet. Pick <em>On My iPhone → PocketSplit</em> or <em>iCloud Drive</em>.</p></div>
        <div class="step-item"><p><strong>Send it to your PC</strong> with AirDrop, email, WhatsApp “Document”, or iCloud Drive. This is a manual transfer, not automatic cloud sync.</p></div>
        <div class="step-item"><p><strong>Keep more than one copy.</strong> A backup stored only on the same phone will disappear with the phone.</p></div>
        <div class="step-item"><p><strong>To restore on a new iPhone,</strong> install PocketSplit, open this screen and choose the file. Merge is safest; Replace wipes current data first.</p></div>
      </div>
      <p class="report-note">PocketSplit is not a cloud service. If a file is in iCloud Drive, that is because you chose to save it there — the app itself never uploads anything.</p>
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>What is inside a backup</h2>
        <span>Format 1</span>
      </div>
      <p class="page-sub">Every transaction with its ID, section, direction, description, amount, date, time, optional note, worker link and payment type. Worker names and creation dates. A checksum detects editing or corruption. App version ${escapeHTML(APP_VERSION)}.</p>
      <details class="backup-details">
        <summary>Why the checksum matters ${icon('chevron-down', 13, 'option-chev')}</summary>
        <p class="report-note">If even one character in the data section is changed after export, the checksum no longer matches and PocketSplit refuses to restore the file. This prevents a half-downloaded or hand-edited backup from silently changing your totals.</p>
      </details>
    </div>

    <div class="danger-zone">
      <h2>Erase data on this iPhone</h2>
      <p>This permanently deletes every transaction and worker from this device. It does not delete any backup files you already saved. A backup is required to recover the records afterwards.</p>
      <button class="btn btn-danger-soft btn-block" type="button" id="erase-data" ${hasData ? '' : 'disabled'}>${icon('trash', 17)}Erase all records</button>
    </div>

    <div class="help-list mt-16">
      <a class="help-row" href="#/more">
        <span class="help-icon">${icon('info', 16)}</span>
        <span class="help-main"><strong>About &amp; installation help</strong><span>Version, iPhone setup and limitations</span></span>
        ${icon('chevron-right', 15, 'chev')}
      </a>
    </div>

    <div class="page-end"></div>
  `;

  const exportFeedback = root.querySelector('#export-feedback');

  async function afterExport(message, tone = 'success') {
    await setMeta('lastBackupAt', nowTimestamp());
    await setMeta('lastBackupTransactionCount', data.transactions.length);
    if (exportFeedback) {
      exportFeedback.innerHTML = alertBox({
        tone,
        title: message,
        text: 'Confirm the file is in Files → Downloads, iCloud Drive, or wherever you sent it.'
      });
    }
    showToast(message, { tone });
    // Refresh the status row and counts without losing the feedback.
    const freshMeta = { ...meta, lastBackupAt: nowTimestamp() };
    const statusEl = root.querySelector('.backup-status');
    if (statusEl) {
      const fresh = statusLine(freshMeta, stats);
      statusEl.querySelector('.status-dot').className = `status-dot ${fresh.tone}`;
      statusEl.querySelector('.backup-status-main strong').textContent = fresh.title;
      statusEl.querySelector('.backup-status-main span').textContent = fresh.detail;
    }
  }

  function buildPayload() {
    return buildBackup({
      workers: data.workers,
      transactions: data.transactions,
      meta
    });
  }

  async function doShare() {
    const payload = buildPayload();
    const filename = formatBackupFilename();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });
    try {
      await navigator.share({ files: [file], title: 'PocketSplit backup' });
      await afterExport('Backup shared successfully.', 'success');
    } catch (error) {
      if (error && error.name === 'AbortError') {
        showToast('Share cancelled. No backup was created.', { tone: 'info' });
        return;
      }
      console.error('Share failed:', error);
      showToast('The share sheet failed. Use “Download file” instead.', { tone: 'error' });
    }
  }

  async function doDownload() {
    const payload = buildPayload();
    const filename = formatBackupFilename();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const ok = downloadBlob(blob, filename);
    if (!ok) {
      showToast('The backup could not be created on this device.', { tone: 'error' });
      return;
    }
    await afterExport('Backup file created. Download started.', 'success');
  }

  root.querySelector('#share-backup')?.addEventListener('click', doShare);
  root.querySelector('#download-backup')?.addEventListener('click', doDownload);

  /* ---------------- Restore ---------------- */

  const fileInput = root.querySelector('#restore-file');
  const chooseButton = root.querySelector('#choose-backup');
  const restoreArea = root.querySelector('#restore-area');
  let pending = null;

  chooseButton.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  function chooseAnother() {
    fileInput.value = '';
    fileInput.click();
  }

  function renderRestorePreview(result, fileName, fileSize) {
    if (!result.ok) {
      restoreArea.innerHTML = `
        ${errorsMarkup(result.errors)}
        ${warningsMarkup(result.warnings)}
        <button class="btn btn-secondary btn-block mt-12" type="button" data-choose-another>${icon('upload', 17)}Choose another file</button>`;
      restoreArea.querySelector('[data-choose-another]')?.addEventListener('click', chooseAnother);
      return;
    }

    const summary = result.summary;
    const exported = result.exportedAt ? formatTimestamp(result.exportedAt) : 'Not stated in the file';
    restoreArea.innerHTML = `
      <div class="restore-preview">
        <div class="preview-file">
          <span class="preview-file-icon">${icon('file', 17)}</span>
          <span class="preview-file-main">
            <strong>${escapeHTML(fileName || 'Backup file')}</strong>
            <span>${escapeHTML(formatFileSize(fileSize))} · exported ${escapeHTML(exported)}</span>
          </span>
        </div>
        <div class="preview-stats">
          <div class="preview-stat"><span>Transactions</span><strong>${summary.transactions}</strong></div>
          <div class="preview-stat"><span>Workers</span><strong>${summary.workers}</strong></div>
          <div class="preview-stat"><span>Shop expenses</span><strong>${escapeHTML(formatPKR(summary.shopExpenses))}</strong></div>
          <div class="preview-stat"><span>Home expenses</span><strong>${escapeHTML(formatPKR(summary.homeExpenses))}</strong></div>
          <div class="preview-stat"><span>Combined expenses</span><strong>${escapeHTML(formatPKR(summary.totalExpenses))}</strong></div>
          <div class="preview-stat"><span>Repayments received</span><strong>${escapeHTML(formatPKR(summary.repayments))}</strong></div>
        </div>
      </div>
      ${warningsMarkup(result.warnings)}
      <div class="mode-choice" role="radiogroup" aria-label="Restore mode">
        <label class="mode-option">
          <input type="radio" name="restore-mode" value="merge" checked>
          <span><strong>Merge with existing data (recommended)</strong><span>Adds records that are not already here. Existing records stay untouched; identical IDs are skipped.</span></span>
        </label>
        <label class="mode-option">
          <input type="radio" name="restore-mode" value="replace">
          <span><strong>Replace all data</strong><span>Deletes every current transaction and worker first, then imports this backup. Cannot be undone.</span></span>
        </label>
      </div>
      <div id="mode-warning">${restoreModeWarning('merge')}</div>
      <div class="backup-actions">
        <button class="btn btn-primary btn-block" type="button" id="restore-now">${icon('download', 18)}Merge ${summary.transactions} transactions</button>
        <button class="btn btn-secondary btn-block" type="button" data-choose-another>Choose a different file</button>
      </div>`;

    restoreArea.querySelector('[data-choose-another]')?.addEventListener('click', chooseAnother);

    const modeWarning = restoreArea.querySelector('#mode-warning');
    const restoreButton = restoreArea.querySelector('#restore-now');
    restoreArea.querySelectorAll('input[name="restore-mode"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const mode = restoreArea.querySelector('input[name="restore-mode"]:checked').value;
        modeWarning.innerHTML = restoreModeWarning(mode);
        restoreButton.textContent = mode === 'replace'
          ? `Replace everything with ${summary.transactions} transactions`
          : `Merge ${summary.transactions} transactions`;
        restoreButton.className = `btn btn-block ${mode === 'replace' ? 'btn-danger' : 'btn-primary'}`;
      });
    });

    restoreButton.addEventListener('click', async () => {
      const mode = restoreArea.querySelector('input[name="restore-mode"]:checked').value;
      const confirmed = await confirmDialog({
        title: mode === 'replace' ? 'Replace all data?' : 'Merge this backup?',
        message: mode === 'replace'
          ? 'Every current transaction and worker will be deleted, then this backup will be imported. This cannot be undone unless you have another backup.'
          : 'New records from this file will be added. Records already on this iPhone with the same IDs are skipped.',
        details: [
          `${summary.transactions} transactions · ${summary.workers} workers in the file`,
          `Current device: ${stats.transactions} transactions · ${stats.workers} workers`,
          mode === 'replace' ? 'Mode: replace everything' : 'Mode: merge safely'
        ],
        confirmText: mode === 'replace' ? 'Replace everything' : 'Merge records',
        tone: mode === 'replace' ? 'danger' : 'default'
      });
      if (!confirmed) return;

      restoreButton.disabled = true;
      restoreButton.textContent = 'Restoring…';
      try {
        const restored = await restoreData({
          workers: result.data.workers,
          transactions: result.data.transactions,
          mode
        });
        await setMeta('lastRestoreAt', nowTimestamp());
        lastRestoreResult = restored;
        showToast(
          restored.transactionsAdded > 0
            ? `Restored ${restored.transactionsAdded} transaction${restored.transactionsAdded === 1 ? '' : 's'}.`
            : 'Restore checked: no new records were added.',
          { tone: 'success', duration: 5000 }
        );
        pending = null;
        await render(root, params);
      } catch (error) {
        console.error(error);
        restoreButton.disabled = false;
        restoreButton.textContent = mode === 'replace' ? 'Try restore again' : 'Try merge again';
        restoreArea.insertAdjacentHTML('afterbegin', errorsMarkup([escapeHTML(error.message || 'The restore failed. No records were changed.')]));
      }
    });
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    restoreArea.innerHTML = '<p class="inline-empty">Checking the file…</p>';
    try {
      const result = await readBackupFile(file);
      if (!result.ok) {
        pending = null;
        renderRestorePreview(result, file.name, file.size);
        return;
      }
      pending = { result, file };
      renderRestorePreview(result, file.name, file.size);
    } catch (error) {
      console.error(error);
      restoreArea.innerHTML = errorsMarkup(['The file could not be read. Try choosing it again from the Files app.']);
    }
  });

  /* ---------------- Erase ---------------- */

  root.querySelector('#erase-data')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Erase all records?',
      message: 'Every transaction and every worker will be permanently deleted from this iPhone. This cannot be undone without a backup file.',
      details: [
        `${stats.transactions} transactions`,
        `${stats.workers} workers`,
        'Saved backup files are not affected'
      ],
      confirmText: 'Erase everything',
      cancelText: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await clearEverything();
      lastRestoreResult = null;
      showToast('All records erased from this iPhone.', { tone: 'success' });
      await render(root, params);
    } catch (error) {
      showToast(error.message || 'The records could not be erased.', { tone: 'error' });
    }
  });
}

export async function run(root, params) {
  await render(root, params);
}
