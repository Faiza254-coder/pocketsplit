/*
 * About & help: iPhone installation, offline status, update check and honest limits.
 */

import {
  APP_VERSION, isIOS, isStandalone, escapeHTML
} from '../utils.js';
import { backButton, brandLockup, icon, logoMark, showToast } from '../components.js';
import { checkForUpdates } from '../updates.js';

export async function run(root) {
  const standalone = isStandalone();
  const ios = isIOS();
  const online = navigator.onLine;
  const controller = 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null;

  root.innerHTML = `
    <div class="page-top">
      ${backButton('#/backup', 'Back to backup')}
      <div class="page-top-actions">
        ${brandLockup({ small: true })}
      </div>
    </div>

    <header class="page-heading">
      <div class="page-heading-main">
        <p class="eyebrow">About &amp; help</p>
        <h1 class="page-title">PocketSplit</h1>
        <p class="page-sub">A private expense diary for the shop and the home.</p>
      </div>
    </header>

    <div class="card about-card">
      ${logoMark(62)}
      <h2>PocketSplit</h2>
      <p>Two pockets, one clear record. Built for a pharmacy owner who wants to remember what left his pocket — not to replace his sales software.</p>
      <span class="version-pill">Version ${escapeHTML(APP_VERSION)} · PWA</span>
    </div>

    <div class="help-list mt-16">
      <a class="help-row" href="#/add">
        <span class="help-icon">${icon('plus', 16)}</span>
        <span class="help-main"><strong>Add an expense</strong><span>Shop, home, salary, bill or anything else</span></span>
        ${icon('chevron-right', 15, 'chev')}
      </a>
      <a class="help-row" href="#/workers">
        <span class="help-icon">${icon('users', 16)}</span>
        <span class="help-main"><strong>Workers &amp; payments</strong><span>Salaries, advances, extras and repayments</span></span>
        ${icon('chevron-right', 15, 'chev')}
      </a>
      <a class="help-row" href="#/history">
        <span class="help-icon">${icon('list', 16)}</span>
        <span class="help-main"><strong>All transactions</strong><span>Search, filter, edit and delete</span></span>
        ${icon('chevron-right', 15, 'chev')}
      </a>
      <a class="help-row" href="#/backup">
        <span class="help-icon">${icon('shield', 16)}</span>
        <span class="help-main"><strong>Backup &amp; restore</strong><span>Export a safe copy of every record</span></span>
        ${icon('chevron-right', 15, 'chev')}
      </a>
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>On this iPhone</h2>
        <span>${standalone ? 'Installed' : ios ? 'Safari' : 'Browser'}</span>
      </div>
      <div class="kv-list">
        <div class="kv-row"><span>Connection</span><strong>${online ? 'Online' : 'Offline — still working'}</strong></div>
        <div class="kv-row"><span>Offline app files</span><strong>${controller ? 'Ready' : 'Preparing / unavailable'}</strong></div>
        <div class="kv-row"><span>Home Screen mode</span><strong>${standalone ? 'Yes' : 'No'}</strong></div>
        <div class="kv-row"><span>Data location</span><strong>This device only</strong></div>
      </div>
      <div class="backup-actions">
        <button class="btn btn-secondary btn-block" type="button" id="check-updates">${icon('refresh', 17)}Check for app updates</button>
      </div>
      <p class="report-note">Updates only change the app files. Your financial records stay in the local database and are not touched.</p>
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>Install as an app</h2>
        <span>No App Store</span>
      </div>
      ${standalone
        ? `<div class="alert alert-success">
            <span class="alert-icon">${icon('check', 18)}</span>
            <div class="alert-body"><strong>You are using the installed app</strong><p>Keep using this Home Screen icon. It has its own storage, separate from Safari. Export regular backups.</p></div>
          </div>`
        : `<p class="page-sub">PocketSplit is a Progressive Web App. There is no paid developer account and no App Store download. On the iPhone:</p>
          <div class="step-list">
            <div class="step-item"><p><strong>Open PocketSplit in Safari.</strong> The installed icon must be added from Safari.</p></div>
            <div class="step-item"><p><strong>Tap the Share button.</strong> It is the square with an arrow at the bottom of the screen.</p></div>
            <div class="step-item"><p><strong>Scroll and tap “Add to Home Screen”.</strong> If iOS offers “Open as Web App”, leave it on.</p></div>
            <div class="step-item"><p><strong>Tap “Add”.</strong> Open PocketSplit from the new icon from then on.</p></div>
          </div>
          <div class="alert alert-warn mt-12">
            <span class="alert-icon">${icon('alert', 18)}</span>
            <div class="alert-body"><strong>Use one version consistently</strong><p>A Home Screen app keeps separate storage from a Safari tab. Data added in Safari will not appear inside the icon. Choose the icon, and use backups if you switch.</p></div>
          </div>`}
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>What PocketSplit does not do</h2>
        <span>By design</span>
      </div>
      <div class="data-list">
        <div class="data-line">${icon('x', 14)}<span>It does not record sales, calculate profit, or replace your pharmacy billing software.</span></div>
        <div class="data-line">${icon('x', 14)}<span>It does not manage stock, suppliers or customers.</span></div>
        <div class="data-line">${icon('x', 14)}<span>It does not sync between phones, and there is no online account.</span></div>
        <div class="data-line">${icon('x', 14)}<span>It is not a tax or statutory accounting system. Keep supporting receipts where required.</span></div>
      </div>
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>Privacy</h2>
        <span>No tracking</span>
      </div>
      <div class="data-list">
        <div class="data-line">${icon('lock', 14)}<span>No sign-up, no login, no analytics and no remote APIs for saving or calculating records.</span></div>
        <div class="data-line">${icon('wifi-off', 14)}<span>After the first load, the app opens and saves expenses without internet. The only network request is checking for app updates when you ask.</span></div>
        <div class="data-line">${icon('shield', 14)}<span>Clearing Safari website data or deleting the app can erase local records. Regular JSON backups are the only protection.</span></div>
      </div>
    </div>

    <div class="card report-cards">
      <div class="report-card-head">
        <h2>If something looks wrong</h2>
        <span>Troubleshooting</span>
      </div>
      <div class="step-list">
        <div class="step-item"><p><strong>Records are missing after opening the icon?</strong> Data in Safari and the Home Screen app are separate. Restore your latest backup from the Backup screen.</p></div>
        <div class="step-item"><p><strong>App will not open offline?</strong> Connect to the internet once, open PocketSplit, wait a moment, then close and reopen. The service worker needs one successful load.</p></div>
        <div class="step-item"><p><strong>Totals look unexpected?</strong> Open All transactions, check the pocket and date filters, then edit the record. Totals recalculate immediately.</p></div>
        <div class="step-item"><p><strong>Save fails?</strong> Free some iPhone storage and check Safari is not in Private Browsing. PocketSplit shows an error instead of silently discarding a record.</p></div>
      </div>
    </div>

    <p class="about-foot">
      PocketSplit ${escapeHTML(APP_VERSION)} · Built as an offline-first web app using HTML, CSS, JavaScript and IndexedDB.<br>
      No subscriptions. No paid services. No sales data. Your records remain on your device.
    </p>
    <div class="page-end"></div>
  `;

  root.querySelector('#check-updates')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Checking…';
    try {
      const result = await checkForUpdates();
      const messages = {
        current: 'PocketSplit is up to date.',
        updating: 'Update found. The app will reload in a moment.',
        available: 'An update is downloading. Reopen the app shortly.',
        unsupported: 'Update checks need the app to be opened from its GitHub Pages address, not from a file.',
        error: 'The update check could not reach the internet. The app keeps working offline.'
      };
      showToast(messages[result.status] || messages.error, {
        tone: result.status === 'error' || result.status === 'unsupported' ? 'info' : 'success',
        duration: 5000
      });
    } catch (error) {
      showToast('The update check failed. Your records are unaffected.', { tone: 'error' });
    } finally {
      button.disabled = false;
      button.innerHTML = `${icon('refresh', 17)}Check for app updates`;
    }
  });
}
