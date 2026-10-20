/*
 * Service-worker registration and update prompts.
 * PocketSplit works fully offline once the shell is cached.
 */
import { showToast } from './components.js';

let registration = null;
let hadController = false;
let reloading = false;
let promptShownFor = null;

function promptUpdate(worker) {
  if (!worker || promptShownFor === worker) return;
  promptShownFor = worker;
  showToast('A new version of PocketSplit is ready.', {
    tone: 'info',
    actionLabel: 'Update',
    duration: 0,
    onAction: () => worker.postMessage({ type: 'SKIP_WAITING' })
  });
}

export async function setupUpdates() {
  if (!('serviceWorker' in navigator)) return { supported: false };
  if (location.protocol === 'file:') return { supported: false, reason: 'file-protocol' };

  hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  try {
    registration = await navigator.serviceWorker.register(new URL('../../sw.js', import.meta.url), { scope: './' });

    if (registration.waiting && hadController) promptUpdate(registration.waiting);

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          promptUpdate(worker);
        }
      });
    });

    return { supported: true, registration };
  } catch (error) {
    console.warn('PocketSplit service worker registration failed:', error);
    return { supported: false, reason: 'registration-failed', error };
  }
}

export async function checkForUpdates() {
  if (!('serviceWorker' in navigator)) return { status: 'unsupported' };
  if (!registration) {
    try {
      registration = await navigator.serviceWorker.getRegistration();
    } catch (error) {
      registration = null;
    }
  }
  if (!registration) return { status: 'unsupported' };

  try {
    await registration.update();
  } catch (error) {
    return { status: 'error' };
  }

  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    return { status: 'updating' };
  }

  // Give the browser a moment to finish checking / installing.
  await new Promise((resolve) => window.setTimeout(resolve, 1200));
  if (registration.installing || registration.waiting) {
    return { status: 'available' };
  }
  return { status: 'current' };
}

export function isServiceWorkerSupported() {
  return 'serviceWorker' in navigator;
}
