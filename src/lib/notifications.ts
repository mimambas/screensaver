// Notification permission + dispatch helpers for alarm firing.
//
// Why a separate module? Three reasons:
//   1. Browser autoplay/notification policies are stateful (the
//      permission is one-shot — once granted/denied, we never ask
//      again). We persist the user's "asked" state so we can decide
//      whether to auto-prompt or not.
//   2. The Notification constructor lives on `window` and isn't
//      available in Node / test envs. All access goes through this
//      module so the rest of the app stays environment-agnostic.
//   3. Service-worker registration is async and singleton-y. We
//      cache the registration promise so re-firing the same alarm
//      doesn't re-register.
//
// The actual notification UI lives in `showAlarmNotification` —
// falls back to in-page flash when:
//   - the permission was denied
//   - the SW is unsupported
//   - the tab is currently visible (foreground — keep the in-page
//     flash and don't double-bother the user)

import { useEffect, useState, useCallback } from 'react';

const PERMISSION_KEY = 'screensaver.notification.v1';
const SW_URL = '/sw.js';

export type NotificationStatus = 'default' | 'granted' | 'denied' | 'unsupported';

function getNotificationCtor(): typeof Notification | null {
  if (typeof window === 'undefined') return null;
  if ('Notification' in window) return window.Notification;
  return null;
}

function readStoredPermission(): 'default' | 'granted' | 'denied' | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PERMISSION_KEY);
    if (raw === 'default' || raw === 'granted' || raw === 'denied') return raw;
    return null;
  } catch {
    return null;
  }
}

function writeStoredPermission(p: 'default' | 'granted' | 'denied'): void {
  try {
    window.localStorage.setItem(PERMISSION_KEY, p);
  } catch {
    /* ignore */
  }
}

/** Current effective permission state, snapshotted from the browser. */
export function getPermissionStatus(): NotificationStatus {
  const Ctor = getNotificationCtor();
  if (!Ctor) return 'unsupported';
  // Notification.permission is the source of truth (live browser state).
  return Ctor.permission as NotificationStatus;
}

/**
 * Request notification permission. Resolves to the new permission
 * state. Idempotent — calling when already granted/denied just
 * returns the current value without showing a prompt.
 *
 * Must be called from a user-gesture handler (e.g. button click).
 * We persist the resulting state so we know not to re-prompt.
 */
export async function requestPermission(): Promise<NotificationStatus> {
  const Ctor = getNotificationCtor();
  if (!Ctor) return 'unsupported';
  if (Ctor.permission !== 'default') {
    writeStoredPermission(Ctor.permission as 'default' | 'granted' | 'denied');
    return Ctor.permission as NotificationStatus;
  }
  try {
    const result = await Ctor.requestPermission();
    const status = (result as NotificationStatus) ?? 'default';
    writeStoredPermission(status as 'default' | 'granted' | 'denied');
    return status;
  } catch {
    return 'denied';
  }
}

let _swRegPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/** Get (or register) the service worker. Cached for the page lifetime. */
function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (_swRegPromise) return _swRegPromise;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    _swRegPromise = Promise.resolve(null);
    return _swRegPromise;
  }
  _swRegPromise = navigator.serviceWorker
    .register(SW_URL)
    .then((reg) => reg)
    .catch(() => null);
  return _swRegPromise;
}

export interface AlarmNotificationOptions {
  /** Stable id so duplicate-fire suppression works across SWs. */
  alarmId: string;
  title: string;
  /** Time string HH:MM, used as the notification body. */
  time: string;
  label?: string;
  /** Snooze URL fragment — handled by the SW notificationclick handler. */
  snoozeUrl?: string;
}

/**
 * Show an OS notification. Returns true if dispatched, false if
 * fallback (denied, unsupported, or foreground tab). Callers can
 * use the boolean to decide whether to also fire the in-page flash.
 *
 * Tab visibility check: if the tab is currently visible, we don't
 * show a notification — the user is already looking at the screen
 * and the in-page flash is enough. This prevents the case where a
 * user is actively using the app and an alarm fires.
 */
export async function showAlarmNotification(
  opts: AlarmNotificationOptions,
): Promise<boolean> {
  // Foreground tab: skip notification. The in-page flash in
  // AlarmList is the UX in this case.
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return false;
  }
  const Ctor = getNotificationCtor();
  if (!Ctor || Ctor.permission !== 'granted') return false;
  const reg = await getServiceWorkerRegistration();
  const body = opts.label ? `${opts.time} — ${opts.label}` : opts.time;
  // Tag by alarmId so re-firing within the OS notification lifetime
  // replaces the previous one (no stacking).
  try {
    if (reg) {
      await reg.showNotification(opts.title, {
        body,
        tag: `alarm-${opts.alarmId}`,
        requireInteraction: true,
        // No icon URL passed — we use the app's default icon.
        // (The browser pulls /icon-192.png from manifest automatically.)
        ...(opts.snoozeUrl ? { data: { snoozeUrl: opts.snoozeUrl } } : {}),
      });
    } else {
      new Ctor(opts.title, {
        body,
        tag: `alarm-${opts.alarmId}`,
        requireInteraction: true,
      });
    }
    return true;
  } catch {
    return false;
  }
}

// ── React hook ────────────────────────────────────────────────────
// useNotificationPermission — subscribe to permission changes (live
// updates if the user revokes via browser settings while the tab
// is open). The hook returns [status, request] — `request` is
// async; UI can wire it to a button onClick.

export function useNotificationPermission(): [NotificationStatus, () => Promise<NotificationStatus>] {
  const [status, setStatus] = useState<NotificationStatus>(() => {
    // Read the cached state first so we don't flash "default" before
    // the live check. Then upgrade with the live browser state.
    const stored = readStoredPermission();
    if (stored) return stored;
    return getPermissionStatus();
  });

  // Live-sync with the browser in case the user revokes via
  // settings while the tab is open.
  useEffect(() => {
    const sync = () => setStatus(getPermissionStatus());
    // Some browsers fire `visibilitychange` when the user comes back
    // from settings — re-check on that. Also poll once on mount
    // since permission may have changed since the cached read.
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const request = useCallback(async () => {
    const next = await requestPermission();
    setStatus(next);
    return next;
  }, []);

  return [status, request];
}
