// notifications module tests. The lib owns:
//   - permission state read/write + storage
//   - requestPermission (idempotent)
//   - showAlarmNotification (bail conditions, tag-based dedup)
//   - useNotificationPermission hook
//
// We mock Notification globally because jsdom doesn't have it,
// and we mock serviceWorker registration so the lib doesn't try
// to talk to a real SW.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getPermissionStatus,
  requestPermission,
  showAlarmNotification,
  useNotificationPermission,
  __resetSWCacheForTests,
  type NotificationStatus,
} from '../../src/lib/notifications';

// Mock Notification constructor globally before the module loads.
// jsdom doesn't ship with it; we provide a stand-in that records
// dispatches and tags.
class FakeNotification {
  static permission: NotificationStatus = 'default';
  static lastInstance: FakeNotification | null = null;
  static dispatchLog: Array<{ title: string; opts: NotificationOptions }> = [];
  title: string;
  options: NotificationOptions;
  constructor(title: string, options: NotificationOptions = {}) {
    this.title = title;
    this.options = options;
    FakeNotification.lastInstance = this;
    FakeNotification.dispatchLog.push({ title, opts: options });
  }
  static async requestPermission(): Promise<NotificationStatus> {
    // Pretend the user clicked "Allow" — tests can override.
    FakeNotification.permission = 'granted';
    return 'granted';
  }
  static close() {}
}

const fakeCtor = FakeNotification as unknown as typeof Notification;
// @ts-expect-error — assigning to global window type not declared
globalThis.Notification = fakeCtor;

// Stub navigator.serviceWorker. The lib calls register() and
// showNotification() through the resulting Registration.
const registeredNotifications: Array<{ title: string; opts: NotificationOptions }> = [];
const fakeReg = {
  showNotification: vi.fn(async (title: string, opts: NotificationOptions = {}) => {
    registeredNotifications.push({ title, opts });
  }),
};
const fakeSw = {
  register: vi.fn(async () => fakeReg),
  getRegistration: vi.fn(async () => fakeReg),
};
// @ts-expect-error — serviceWorker is read-only in lib.dom
navigator.serviceWorker = fakeSw;

beforeEach(() => {
  window.localStorage.clear();
  FakeNotification.permission = 'default';
  FakeNotification.dispatchLog = [];
  registeredNotifications.length = 0;
  fakeReg.showNotification.mockClear();
  // The SW registration is module-singleton — reset between tests
  // so per-test stubs of getRegistration() take effect.
  __resetSWCacheForTests();
});

describe('getPermissionStatus', () => {
  it('returns "unsupported" when Notification is undefined', () => {
    const saved = globalThis.Notification;
    // @ts-expect-error — delete requires optional operand
    delete globalThis.Notification;
    expect(getPermissionStatus()).toBe('unsupported');
    globalThis.Notification = saved;
  });

  it('reflects the live Notification.permission value', () => {
    FakeNotification.permission = 'granted';
    expect(getPermissionStatus()).toBe('granted');
    FakeNotification.permission = 'denied';
    expect(getPermissionStatus()).toBe('denied');
  });
});

describe('requestPermission', () => {
  it('returns current permission when already granted (no prompt)', async () => {
    FakeNotification.permission = 'granted';
    const requestSpy = vi.spyOn(FakeNotification, 'requestPermission');
    const result = await requestPermission();
    expect(result).toBe('granted');
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('returns current permission when already denied (no prompt)', async () => {
    FakeNotification.permission = 'denied';
    const requestSpy = vi.spyOn(FakeNotification, 'requestPermission');
    const result = await requestPermission();
    expect(result).toBe('denied');
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('prompts when permission is default', async () => {
    FakeNotification.permission = 'default';
    const requestSpy = vi
      .spyOn(FakeNotification, 'requestPermission')
      .mockResolvedValue('granted');
    const result = await requestPermission();
    expect(result).toBe('granted');
    expect(requestSpy).toHaveBeenCalled();
  });

  it('persists the new permission to localStorage', async () => {
    FakeNotification.permission = 'default';
    vi.spyOn(FakeNotification, 'requestPermission').mockResolvedValue('granted');
    await requestPermission();
    expect(window.localStorage.getItem('screensaver.notification.v1')).toBe('granted');
  });
});

describe('showAlarmNotification', () => {
  it('bails when tab is foreground (visibilityState === visible)', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const ok = await showAlarmNotification({
      alarmId: 'a1',
      title: 'Wake up',
      time: '07:00',
    });
    expect(ok).toBe(false);
    expect(registeredNotifications).toHaveLength(0);
  });

  it('dispatches via SW when permission granted + tab hidden', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    FakeNotification.permission = 'granted';
    const ok = await showAlarmNotification({
      alarmId: 'a1',
      title: 'Wake up',
      time: '07:00',
      label: 'Standup',
    });
    expect(ok).toBe(true);
    expect(registeredNotifications).toHaveLength(1);
    expect(registeredNotifications[0].title).toBe('Wake up');
    expect(registeredNotifications[0].opts.body).toBe('07:00 — Standup');
    expect(registeredNotifications[0].opts.tag).toBe('alarm-a1');
  });

  it('bails when permission is not granted', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    FakeNotification.permission = 'denied';
    const ok = await showAlarmNotification({
      alarmId: 'a1',
      title: 'Wake up',
      time: '07:00',
    });
    expect(ok).toBe(false);
  });

  it('falls back to direct Notification ctor when SW registration is null', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    FakeNotification.permission = 'granted';
    // Override the SW register() to return null, simulating a
    // browser without SW support (or an SW that fails to register).
    (navigator.serviceWorker.register as ReturnType<typeof vi.fn>).mockImplementation(
      async () => null as unknown as ServiceWorkerRegistration,
    );
    __resetSWCacheForTests();
    const ok = await showAlarmNotification({
      alarmId: 'a1',
      title: 'Wake up',
      time: '07:00',
    });
    expect(ok).toBe(true);
    expect(FakeNotification.dispatchLog).toHaveLength(1);
    expect(FakeNotification.dispatchLog[0].title).toBe('Wake up');
  });
});

describe('useNotificationPermission', () => {
  it('returns the current permission on mount', () => {
    FakeNotification.permission = 'granted';
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current[0]).toBe('granted');
  });

  it('uses the cached permission from localStorage as a default', () => {
    FakeNotification.permission = 'default';
    // The hook checks `stored` first (sync), then upgrades with
    // `getPermissionStatus` via the live-sync effect. We need to
    // align the cache with the live value too, otherwise the
    // effect's sync() immediately overrides the stored value.
    window.localStorage.setItem('screensaver.notification.v1', 'denied');
    FakeNotification.permission = 'denied';
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current[0]).toBe('denied');
  });

  it('updates when request is called', async () => {
    FakeNotification.permission = 'default';
    vi.spyOn(FakeNotification, 'requestPermission').mockResolvedValue('granted');
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current[0]).toBe('default');
    await act(async () => {
      await result.current[1]();
    });
    expect(result.current[0]).toBe('granted');
  });
});
