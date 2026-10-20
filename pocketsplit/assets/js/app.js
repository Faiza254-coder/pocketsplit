/*
 * PocketSplit — application shell and router.
 * No build step: this file is loaded directly as an ES module.
 */

import {
  APP_VERSION, escapeHTML, isStandalone
} from './utils.js';
import * as database from './db.js';
import {
  tabbar, showToast, closeAllLayers, hasOpenLayer, brandLockup, icon,
  alertBox
} from './components.js';
import { setupUpdates } from './updates.js';
import * as dashboardView from './views/dashboard.js';
import * as expensesView from './views/expenses.js';
import * as workersView from './views/workers.js';
import * as reportsView from './views/reports.js';
import * as backupView from './views/backup.js';
import * as moreView from './views/more.js';

const app = document.getElementById('app');
let routeToken = 0;
let lastErrorToast = { message: '', at: 0 };

const SHELL = `
  <main id="view" class="view" tabindex="-1"></main>
  <div id="tabbar-host"></div>
`;

function decodeSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function currentLocation() {
  const raw = window.location.hash ? window.location.hash.slice(1) : '';
  const queryIndex = raw.indexOf('?');
  const pathPart = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const queryPart = queryIndex >= 0 ? raw.slice(queryIndex + 1) : '';
  const path = pathPart || '/overview';
  const segments = path.split('/').filter(Boolean).map(decodeSegment);
  let params;
  try {
    params = new URLSearchParams(queryPart);
  } catch (error) {
    params = new URLSearchParams();
  }
  return { path, segments, params };
}

function resolveRoute({ segments, params }) {
  const [first, second] = segments;

  if (!first || first === 'overview') {
    return {
      name: 'overview',
      title: 'Overview',
      tab: 'overview',
      run: (root) => dashboardView.run(root, params)
    };
  }

  if (first === 'shop' && !second) {
    return {
      name: 'shop',
      title: 'Shop expenses',
      tab: 'shop',
      run: (root) => expensesView.runSection(root, params, 'shop')
    };
  }

  if (first === 'home' && !second) {
    return {
      name: 'home',
      title: 'Home expenses',
      tab: 'home',
      run: (root) => expensesView.runSection(root, params, 'home')
    };
  }

  if (first === 'history' && !second) {
    const section = params.get('section');
    return {
      name: 'history',
      title: 'All transactions',
      tab: section === 'home' ? 'home' : section === 'shop' ? 'shop' : '',
      run: (root) => expensesView.runHistory(root, params)
    };
  }

  if (first === 'workers' && !second) {
    return {
      name: 'workers',
      title: 'Workers',
      tab: 'shop',
      run: (root) => workersView.runWorkers(root, params)
    };
  }

  if (first === 'workers' && second) {
    return {
      name: 'worker',
      title: 'Worker details',
      tab: 'shop',
      run: (root) => workersView.runWorkerDetail(root, params, second)
    };
  }

  if (first === 'reports' && !second) {
    return {
      name: 'reports',
      title: 'Reports',
      tab: 'reports',
      run: (root) => reportsView.run(root, params)
    };
  }

  if (first === 'backup' && !second) {
    return {
      name: 'backup',
      title: 'Backup & restore',
      tab: 'backup',
      run: (root) => backupView.run(root, params)
    };
  }

  if (first === 'more' && !second) {
    return {
      name: 'more',
      title: 'About & help',
      tab: '',
      run: (root) => moreView.run(root, params)
    };
  }

  if (first === 'add' && !second) {
    return {
      name: 'add',
      title: 'Add expense',
      tab: null,
      run: (root) => expensesView.runForm(root, params, null)
    };
  }

  if (first === 'edit' && second) {
    return {
      name: 'edit',
      title: 'Edit expense',
      tab: null,
      run: (root) => expensesView.runForm(root, params, second)
    };
  }

  return null;
}

function updateTabbar(def) {
  const host = document.getElementById('tabbar-host');
  if (!host) return;
  const visible = def.tab !== null && def.tab !== undefined;
  host.innerHTML = tabbar(def.tab || '', visible);
}

function renderViewError(view, error) {
  const message = error && error.message
    ? error.message
    : 'PocketSplit could not load this screen.';
  view.innerHTML = `
    <div class="page-top">${brandLockup()}</div>
    <div class="mt-20">
      ${alertBox({
        tone: 'danger',
        title: 'This screen could not open',
        text: message
      })}
      <div class="stack-8 mt-16">
        <button class="btn btn-primary btn-block" type="button" data-reload>Try again</button>
        <a class="btn btn-secondary btn-block" href="#/overview">Go to overview</a>
      </div>
      <p class="disabled-hint" style="text-align:center">Your saved records were not changed.</p>
    </div>`;
  view.querySelector('[data-reload]')?.addEventListener('click', () => window.location.reload());
}

async function route() {
  const token = ++routeToken;
  if (hasOpenLayer()) closeAllLayers();

  const location = currentLocation();
  const def = resolveRoute(location);

  if (!def) {
    if (location.path !== '/overview') {
      window.location.replace(`${window.location.pathname}${window.location.search}#/overview`);
      return;
    }
    return;
  }

  const view = document.getElementById('view');
  if (!view) return;

  if (def.name !== 'add' && def.name !== 'edit') {
    // Return to the top for fresh pages, but not while editing.
    window.scrollTo(0, 0);
  }
  view.innerHTML = '';
  view.className = `view ${def.tab === null || def.tab === undefined ? 'no-tabs' : ''}`;
  updateTabbar(def);
  document.title = `${def.title} · PocketSplit`;

  try {
    await def.run(view);
    if (token !== routeToken) return;
    if (!view.innerHTML.trim()) {
      renderViewError(view, new Error('The screen returned no content.'));
    }
  } catch (error) {
    if (token !== routeToken) return;
    console.error('PocketSplit route failed:', error);
    renderViewError(view, error);
  }

  if (token !== routeToken) return;
  document.documentElement.dataset.ready = 'true';
}

function renderFatal(error) {
  const message = error && error.message
    ? error.message
    : 'PocketSplit could not open its local database.';
  app.className = 'fatal';
  app.removeAttribute('aria-busy');
  app.innerHTML = `
    <div class="fatal-card">
      <div class="alert-icon">${icon('alert', 26)}</div>
      <h1>PocketSplit could not start</h1>
      <p>${escapeHTML(message)}</p>
      <div class="stack-8 mt-16">
        <button class="btn btn-primary btn-block" type="button" data-retry>Try again</button>
        <button class="btn btn-secondary btn-block" type="button" data-reload>Reload the app</button>
      </div>
      <p class="disabled-hint" style="margin-top:14px">
        If this keeps happening, close other PocketSplit tabs. In Safari, check
        Settings → Safari → Advanced → Website Data and make sure website data is allowed.
        Your existing backup files are not affected.
      </p>
    </div>`;

  app.querySelector('[data-retry]')?.addEventListener('click', () => window.location.reload());
  app.querySelector('[data-reload]')?.addEventListener('click', () => window.location.reload());
}

function handleUnexpectedError(message) {
  const now = Date.now();
  if (message === lastErrorToast.message && now - lastErrorToast.at < 4000) return;
  lastErrorToast = { message, at: now };
  showToast(message, { tone: 'error', duration: 5000 });
}

async function boot() {
  document.documentElement.dataset.appVersion = APP_VERSION;
  document.documentElement.dataset.standalone = isStandalone() ? 'true' : 'false';

  try {
    await database.initDatabase();
  } catch (error) {
    renderFatal(error);
    return;
  }

  app.className = 'app-shell';
  app.removeAttribute('aria-busy');
  app.innerHTML = SHELL;

  if (!window.location.hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/overview`);
  }

  window.addEventListener('hashchange', route);

  window.addEventListener('offline', () => {
    showToast('You are offline. PocketSplit keeps working and saves on this iPhone.', {
      tone: 'info', duration: 4800
    });
  });

  window.addEventListener('online', () => {
    showToast('Back online. PocketSplit still works offline whenever you need it.', {
      tone: 'success', duration: 3800
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('PocketSplit unhandled rejection:', event.reason);
    handleUnexpectedError('Something went wrong. Your saved records were not changed.');
  });

  window.addEventListener('error', (event) => {
    if (!event || !event.message) return;
    console.error('PocketSplit error:', event.error || event.message);
  });

  await route();

  database.requestPersistentStorage().catch(() => {});

  setupUpdates().catch((error) => {
    console.warn('Service worker setup failed:', error);
  });

  if (!navigator.onLine) {
    window.setTimeout(() => {
      showToast('PocketSplit is running offline from saved files on this device.', {
        tone: 'info', duration: 4500
      });
    }, 700);
  }
}

boot();
