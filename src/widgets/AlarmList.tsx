import { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, BellOff, Plus, Trash2, X } from 'lucide-react';
import { playChime, unlockAudio } from './audio';
import type { ThemeName } from './clock-constants';
import { useT } from '../i18n';
import {
  showAlarmNotification,
  useNotificationPermission,
} from '../lib/notifications';

interface Alarm {
  id: string;
  /** "HH:MM" 24-hour local time */
  time: string;
  label: string;
  enabled: boolean;
  /** Days of week to fire. [0..6] = [Sun..Sat]. Empty = every day. */
  days: number[];
  /** When last fired (ms). 0 = never. Used to avoid re-firing same minute. */
  lastFired: number;
  /** Optional snooze target (HH:MM), when alarm was snoozed earlier today. */
  snoozeUntil?: string;
  /** One-shot alarms auto-disable after firing. */
  oneShot: boolean;
}

const STORAGE_KEY = 'screensaver.alarms.v1';

function loadAlarms(): Alarm[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Alarm[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is Alarm =>
        a != null &&
        typeof a.id === 'string' &&
        typeof a.time === 'string' &&
        /^\d{2}:\d{2}$/.test(a.time) &&
        typeof a.label === 'string' &&
        typeof a.enabled === 'boolean' &&
        Array.isArray(a.days) &&
        (a.snoozeUntil === undefined || typeof a.snoozeUntil === 'string') &&
        typeof a.oneShot === 'boolean',
    );
  } catch {
    return [];
  }
}

function saveAlarms(alarms: Alarm[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  } catch {
    // ignore
  }
}

// Single-letter day labels rendered in the alarm chips. The full
// names live in the i18n catalog and feed the title/aria-label
// attributes below.
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_KEYS_SHORT = [
  'alarm.dow.sun',
  'alarm.dow.mon',
  'alarm.dow.tue',
  'alarm.dow.wed',
  'alarm.dow.thu',
  'alarm.dow.fri',
  'alarm.dow.sat',
] as const;

export function AlarmList({
  theme = 'dark',
}: {
  theme?: ThemeName;
}) {
  const t = useT();
  const [alarms, setAlarms] = useState<Alarm[]>(loadAlarms);
  const [showAdd, setShowAdd] = useState(false);
  const [firingId, setFiringId] = useState<string | null>(null);
  const flashRef = useRef<number | null>(null);
  // Notification permission state — the value is unused at the
  // component level (settings panel may surface a toggle) but
  // registering the hook keeps the SW alive.
  const [notificationStatus] = useNotificationPermission();

  // Listen for alarm-notification-click messages from the SW (sent
  // when the user taps a fired-alarm notification). We dismiss the
  // firing state so the in-page UI doesn't double-stay.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; alarmId?: string } | null;
      if (data?.type === 'alarm-notification-click' && data.alarmId) {
        // Tag is `alarm-<id>`; strip the prefix.
        const id = data.alarmId.replace(/^alarm-/, '');
        if (flashRef.current !== null) window.clearTimeout(flashRef.current);
        setFiringId(null);
        // Mark the alarm as last-fired-now so the in-page loop
        // doesn't immediately re-fire it.
        setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, lastFired: Date.now() } : a)));
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [notificationStatus]);

  // Persist
  useEffect(() => {
    saveAlarms(alarms);
  }, [alarms]);

  // Unlock audio on first interaction (autoplay policy)
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('mousemove', unlock, { once: true, capture: true });
    window.addEventListener('click', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('mousemove', unlock, { capture: true });
      window.removeEventListener('click', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);

  // Fire-check loop — once a minute is enough for HH:MM granularity.
  useEffect(() => {
    let intervalId: number;
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const current = `${hh}:${mm}`;
      const dow = now.getDay();
      const stamp = now.getTime();

      setAlarms((prev) => {
        let changed = false;
        const next = prev.map((a) => {
          if (!a.enabled) return a;
          // Snooze override: if a snooze target is set, fire on that
          // time instead of the regular time (one-shot).
          const fireTime = a.snoozeUntil ?? a.time;
          if (fireTime !== current) return a;
          // Already fired this minute?
          if (a.lastFired && stamp - a.lastFired < 30_000) return a;
          // Day filter: empty array = every day
          if (a.days.length > 0 && !a.days.includes(dow)) return a;
          // FIRE! Always play the chime in-page (it doesn't depend on
          // visibility — useful for the foreground case too). The
          // notification is best-effort; if it can't dispatch (tab
          // visible, denied, unsupported), we just rely on the in-page
          // flash + chime.
          playChime();
          setFiringId(a.id);
          if (flashRef.current !== null) window.clearTimeout(flashRef.current);
          flashRef.current = window.setTimeout(() => setFiringId(null), 30_000);
          // Best-effort OS notification for background tabs.
          void showAlarmNotification({
            alarmId: a.id,
            title: a.label || 'Alarm',
            time: a.time,
            label: a.label,
            snoozeUrl: `/?snooze=${encodeURIComponent(a.id)}`,
          });
          changed = true;
          // One-shot alarms auto-disable after firing.
          // Snooze target is cleared on fire.
          return { ...a, lastFired: stamp, snoozeUntil: undefined, enabled: a.oneShot ? false : a.enabled };
        });
        return changed ? next : prev;
      });
    };
    // Align to next minute boundary
    const ms = 60_000 - (Date.now() % 60_000);
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60_000);
    }, ms);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      if (flashRef.current !== null) window.clearTimeout(flashRef.current);
    };
  }, []);

  // Dismiss the currently-firing alarm on any key/click.
  useEffect(() => {
    if (firingId === null) return;
    const dismiss = () => {
      if (flashRef.current !== null) window.clearTimeout(flashRef.current);
      setFiringId(null);
    };
    window.addEventListener('keydown', dismiss, { once: true });
    window.addEventListener('click', dismiss, { once: true });
    return () => {
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('click', dismiss);
    };
  }, [firingId]);

  const add = useCallback(
    (time: string, label: string, days: number[], opts: { oneShot?: boolean } = {}) => {
      setAlarms((prev) => [
        ...prev,
        {
          id: `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          time,
          label,
          days,
          enabled: true,
          lastFired: 0,
          oneShot: opts.oneShot ?? false,
        },
      ]);
    },
    [],
  );

  // Snooze a firing alarm by N minutes. Sets the snoozeUntil field
  // so the next tick fires on the snoozed time.
  const snooze = useCallback((id: string, minutes: number) => {
    setAlarms((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const target = new Date(Date.now() + minutes * 60_000);
        const hh = String(target.getHours()).padStart(2, '0');
        const mm = String(target.getMinutes()).padStart(2, '0');
        return { ...a, snoozeUntil: `${hh}:${mm}`, lastFired: 0 };
      }),
    );
    setFiringId(null);
  }, []);

  const remove = useCallback((id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggle = useCallback((id: string) => {
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }, []);

  const update = useCallback((id: string, patch: Partial<Alarm>) => {
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-2">
        <div
          className={`text-xs uppercase tracking-widest flex items-center gap-1 ${
            theme === 'dark' ? 'text-white/60' : theme === 'claude' ? 'text-[#3a2e1f]/70' : 'text-black/60'
          }`}
        >
          <Bell className="w-3 h-3" /> Alarms
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          data-testid="alarm-add-toggle"
          className={`p-1 rounded-full ${
            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'
          }`}
          aria-label={t('alarm.add')}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {showAdd && (
        <AddAlarmForm
          theme={theme}
          onAdd={(t, l, d) => {
            add(t, l, d);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {alarms.length === 0 && !showAdd && (
        <div
          data-testid="alarm-list-empty"
          className={`text-xs italic ${
            theme === 'dark' ? 'text-white/40' : theme === 'claude' ? 'text-[#3a2e1f]/40' : 'text-black/40'
          }`}
        >
          No alarms set
        </div>
      )}

      <div className="space-y-1" data-testid="alarm-list">
        {alarms.map((a) => (
          <div
            data-testid="alarm-row"
            key={a.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
              theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'
            } ${firingId === a.id ? (theme === 'dark' ? 'bg-red-500/20 animate-pulse' : 'bg-red-500/20 animate-pulse') : ''}`}
          >
            <button
              type="button"
              onClick={() => toggle(a.id)}
              className={`p-1 ${a.enabled ? '' : 'opacity-40'}`}
              aria-label={a.enabled ? t('alarm.disable') : t('alarm.enable')}
            >
              {a.enabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={a.time}
                  onChange={(e) => update(a.id, { time: e.target.value })}
                  className={`bg-transparent tabular-nums outline-none w-20 ${
                    theme === 'dark' ? 'text-white' : 'text-black'
                  }`}
                />
                <div className="flex gap-0.5">
                  {DAY_LABELS.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const days = a.days.includes(i)
                          ? a.days.filter((x) => x !== i)
                          : [...a.days, i].sort();
                        update(a.id, { days });
                      }}
                      className={`w-4 h-4 text-[9px] rounded-full transition-colors ${
                        a.days.length === 0 || a.days.includes(i)
                          ? theme === 'dark' ? 'bg-white/30' : 'bg-black/30'
                          : theme === 'dark' ? 'bg-white/5' : 'bg-black/5'
                      }`}
                      title={t(DAY_KEYS_SHORT[i])}
                      aria-label={t('common.add') + ' ' + t(DAY_KEYS_SHORT[i])}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {a.label && (
                <div
                  className={`text-[10px] truncate ${
                    theme === 'dark' ? 'text-white/50' : theme === 'claude' ? 'text-[#3a2e1f]/50' : 'text-black/50'
                  }`}
                >
                  {a.label}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(a.id)}
              className={`p-1 opacity-40 hover:opacity-100 ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'} rounded`}
              aria-label={t('alarm.delete')}
            >
              <Trash2 className="w-3 h-3" />
            </button>
            {firingId === a.id && (
              <button
                type="button"
                onClick={() => snooze(a.id, 5)}
                className={`p-1 text-[10px] rounded ${
                  theme === 'dark' ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-black/15 hover:bg-black/25 text-black'
                }`}
                title={t('alarm.snooze')}
              >
                Zz 5
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddAlarmForm({
  theme,
  onAdd,
  onCancel,
}: {
  theme: ThemeName;
  onAdd: (time: string, label: string, days: number[], opts?: { oneShot?: boolean }) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number[]>([]); // empty = every day
  const [oneShot, setOneShot] = useState(false);
  const [notifStatus, notifRequest] = useNotificationPermission();
  const [testState, setTestState] = useState<'idle' | 'sent' | 'denied'>('idle');

  const handleTest = async () => {
    if (notifStatus === 'unsupported') {
      setTestState('denied');
      window.setTimeout(() => setTestState('idle'), 2000);
      return;
    }
    if (notifStatus !== 'granted') {
      const next = await notifRequest();
      if (next !== 'granted') {
        setTestState('denied');
        window.setTimeout(() => setTestState('idle'), 2000);
        return;
      }
    }
    // Dispatch a one-off test notification.
    const ok = await showAlarmNotification({
      alarmId: `test-${Date.now()}`,
      title: t('alarm.test.title'),
      time,
      label: t('alarm.test.body'),
    });
    setTestState(ok ? 'sent' : 'denied');
    window.setTimeout(() => setTestState('idle'), 2000);
  };

  return (
    <div
      className={`p-2 mb-2 rounded-lg space-y-1.5 ${
        theme === 'dark' ? 'bg-white/5' : theme === 'claude' ? 'bg-[#e8dcc4]/30' : 'bg-black/5'
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={`bg-transparent tabular-nums outline-none ${
            theme === 'dark' ? 'text-white' : 'text-black'
          }`}
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('alarm.label', { opt: t('common.optional') })}
          maxLength={40}
          className={`flex-1 bg-transparent text-xs outline-none ${
            theme === 'dark' ? 'text-white placeholder-white/30' : 'text-black placeholder-black/30'
          }`}
        />
        <button
          type="button"
          onClick={onCancel}
          className="p-1 opacity-60 hover:opacity-100"
          aria-label={t('common.cancel')}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-[10px] opacity-60 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          {days.length === 0 ? 'Every day' : days.length === 7 ? 'Every day' : 'Custom'}
        </span>
        <div className="flex gap-0.5 ml-auto">
          {DAY_LABELS.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setDays((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort()));
              }}
              className={`w-4 h-4 text-[9px] rounded-full transition-colors ${
                days.length === 0 || days.includes(i)
                  ? theme === 'dark' ? 'bg-white/30' : 'bg-black/30'
                  : theme === 'dark' ? 'bg-white/5' : 'bg-black/5'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <label
        className={`flex items-center gap-1.5 text-[10px] ${
          theme === 'dark' ? 'text-white/60' : theme === 'claude' ? 'text-[#3a2e1f]/60' : 'text-black/60'
        }`}
      >
        <input
          type="checkbox"
          checked={oneShot}
          onChange={(e) => setOneShot(e.target.checked)}
          className="accent-current"
        />
        one-shot (auto-disable after firing)
      </label>
      {/* Notification permission test — lets the user verify
          background alerts are working without waiting for an
          alarm to actually fire. Only shown when the platform
          supports the API at all. */}
      {notifStatus !== 'unsupported' && (
        <button
          type="button"
          onClick={handleTest}
          data-testid="alarm-test-notification"
          className={`w-full px-2 py-1 rounded text-[10px] transition-colors ${
            theme === 'dark'
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : theme === 'claude'
              ? 'bg-[#d4b896]/30 hover:bg-[#d4b896]/50 text-[#3a2e1f]'
              : 'bg-black/10 hover:bg-black/20 text-black'
          }`}
          title={
            notifStatus === 'granted'
              ? t('alarm.test.title')
              : t('alarm.test.permission')
          }
        >
          {testState === 'sent'
            ? t('alarm.test.sent')
            : testState === 'denied'
            ? t('alarm.test.denied')
            : notifStatus === 'granted'
            ? t('alarm.test.sentHint')
            : t('alarm.test.permission')}
        </button>
      )}
      <button
        type="button"
        onClick={() => onAdd(time, label.trim(), days, { oneShot })}
        data-testid="alarm-form-submit"
        className={`w-full px-2 py-1 rounded text-xs transition-colors ${
          theme === 'dark' ? 'bg-white/15 hover:bg-white/25' : 'bg-black/15 hover:bg-black/25'
        }`}
      >
        Add alarm
      </button>
    </div>
  );
}
