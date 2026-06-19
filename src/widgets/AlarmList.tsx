import { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, BellOff, Plus, Trash2, X, GripVertical } from 'lucide-react';
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

  // ── Drag-to-reorder listener ─────────────────────────────────
  // The AlarmRow component dispatches a custom event on drop
  // (rather than threading a callback through props). We listen
  // here and splice the moved alarm into the new position. The
  // before/after flag is decided by cursor Y position relative
  // to the target row's midpoint.
  useEffect(() => {
    const onReorder = (e: Event) => {
      const detail = (e as CustomEvent<{ draggedId: string; targetId: string; before: boolean }>).detail;
      setAlarms((prev) => {
        const fromIdx = prev.findIndex((a) => a.id === detail.draggedId);
        const toIdx = prev.findIndex((a) => a.id === detail.targetId);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        // Compute insertion index in the modified array. The
        // `before` flag means insert at toIdx, otherwise at
        // toIdx + 1 (one slot further).
        const insertAt = detail.before ? toIdx : toIdx + 1;
        // Clamp: when splicing fromIdx < toIdx, the index shifts
        // down by 1.
        const adjusted = fromIdx < toIdx ? Math.max(0, insertAt - 1) : Math.min(next.length, insertAt);
        next.splice(adjusted, 0, moved);
        return next;
      });
    };
    window.addEventListener('alarm:reorder', onReorder);
    return () => window.removeEventListener('alarm:reorder', onReorder);
  }, []);

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
        {alarms.map((a, idx) => (
          <AlarmRow
            key={a.id}
            alarm={a}
            index={idx}
            totalCount={alarms.length}
            onToggle={() => toggle(a.id)}
            onUpdate={(patch) => update(a.id, patch)}
            onRemove={() => remove(a.id)}
            onSnooze={() => snooze(a.id, 5)}
            firingId={firingId}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}

// ── AlarmRow — extracted for clarity. Renders one alarm with
//    inline edit (time + label), drag handle, toggle bell,
//    day picker, delete, snooze. The drag handle (GripVertical
//    icon) lets the user reorder by drag-drop on the handle
//    only — the rest of the row is for editing.
//
//    Inline label edit: clicking the label text turns it into
//    an <input>. Enter / blur commits. Escape cancels.

interface AlarmRowProps {
  alarm: Alarm;
  index: number;
  totalCount: number;
  onToggle: () => void;
  onUpdate: (patch: Partial<Alarm>) => void;
  onRemove: () => void;
  onSnooze: () => void;
  firingId: string | null;
  theme: ThemeName;
}

function AlarmRow({
  alarm: a,
  index,
  totalCount,
  onToggle,
  onUpdate,
  onRemove,
  onSnooze,
  firingId,
  theme,
}: AlarmRowProps) {
  const t = useT();
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(a.label);
  const [dragOver, setDragOver] = useState<'top' | 'bottom' | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  // Focus the label input when we enter edit mode. The user
  // expects cursor-in-textbox immediately on click.
  useEffect(() => {
    if (editingLabel) {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    }
  }, [editingLabel]);

  const commitLabel = () => {
    const next = labelDraft.trim();
    if (next !== a.label) onUpdate({ label: next });
    setEditingLabel(false);
  };

  // ── Drag-to-reorder ─────────────────────────────────────────
  // We use HTML5 native drag-and-drop (no extra deps). The drag
  // handle is data-drag-handle so other code paths (e.g. test
  // automation) can target it. drop on a row → swap places.
  const isDark = theme === 'dark';
  const isClaude = theme === 'claude';

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/x-alarm-id', a.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    // We accept moves from other alarm rows. The dragover handler
    // decides whether the indicator should show "drop above" or
    // "drop below" based on cursor Y position relative to the
    // row's midpoint.
    if (!e.dataTransfer.types.includes('text/x-alarm-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    setDragOver(e.clientY < mid ? 'top' : 'bottom');
  };

  const handleDragLeave = () => setDragOver(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/x-alarm-id');
    setDragOver(null);
    if (!draggedId || draggedId === a.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const before = e.clientY < mid;
    // onReorder will be called by the parent through context.
    // We dispatch a custom event the parent listens for so we
    // don't have to thread callbacks through every row.
    window.dispatchEvent(
      new CustomEvent('alarm:reorder', {
        detail: { draggedId, targetId: a.id, before },
      }),
    );
  };

  return (
    <div
      data-testid="alarm-row"
      data-alarm-id={a.id}
      data-alarm-index={index}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
        isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
      } ${
        firingId === a.id ? (isDark ? 'bg-red-500/20 animate-pulse' : 'bg-red-500/20 animate-pulse') : ''
      } ${
        dragOver === 'top'
          ? isDark
            ? 'border-t-2 border-white/40'
            : 'border-t-2 border-black/40'
          : dragOver === 'bottom'
          ? isDark
            ? 'border-b-2 border-white/40'
            : 'border-b-2 border-black/40'
          : ''
      }`}
    >
      {/* Drag handle — separate from the rest of the row so
          the user has a clear grab target. Pointer events on
          the rest of the row are NOT draggable; only this
          handle is. */}
      <button
        type="button"
        data-testid="alarm-drag-handle"
        data-drag-handle="1"
        draggable
        onDragStart={handleDragStart}
        className={`p-1 cursor-grab active:cursor-grabbing ${
          isDark ? 'text-white/40 hover:text-white/70' : isClaude ? 'text-[#3a2e1f]/40 hover:text-[#3a2e1f]/70' : 'text-black/40 hover:text-black/70'
        }`}
        title={`${a.label || 'Alarm'} — drag to reorder (position ${index + 1} of ${totalCount})`}
        aria-label={`Reorder alarm at position ${index + 1}`}
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={onToggle}
        data-testid="alarm-toggle"
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
            onChange={(e) => onUpdate({ time: e.target.value })}
            data-testid="alarm-time"
            className={`bg-transparent tabular-nums outline-none w-20 ${
              isDark ? 'text-white' : isClaude ? 'text-[#3a2e1f]' : 'text-black'
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
                  onUpdate({ days });
                }}
                data-testid={`alarm-day-${i}`}
                className={`w-4 h-4 text-[9px] rounded-full transition-colors ${
                  a.days.length === 0 || a.days.includes(i)
                    ? isDark ? 'bg-white/30' : isClaude ? 'bg-[#3a2e1f]/30' : 'bg-black/30'
                    : isDark ? 'bg-white/5' : isClaude ? 'bg-[#3a2e1f]/5' : 'bg-black/5'
                }`}
                title={t(DAY_KEYS_SHORT[i])}
                aria-label={t('common.add') + ' ' + t(DAY_KEYS_SHORT[i])}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        {editingLabel ? (
          <input
            ref={labelInputRef}
            type="text"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitLabel();
              } else if (e.key === 'Escape') {
                setLabelDraft(a.label);
                setEditingLabel(false);
              }
            }}
            data-testid="alarm-label-input"
            maxLength={40}
            placeholder={t('alarm.label', { opt: t('common.optional') })}
            className={`text-[10px] mt-1 w-full bg-transparent outline-none ${
              isDark ? 'text-white' : isClaude ? 'text-[#3a2e1f]' : 'text-black'
            }`}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setLabelDraft(a.label);
              setEditingLabel(true);
            }}
            data-testid="alarm-label"
            className={`block text-[10px] mt-1 truncate text-left w-full ${
              a.label
                ? isDark ? 'text-white/50' : isClaude ? 'text-[#3a2e1f]/50' : 'text-black/50'
                : isDark ? 'text-white/30 italic' : isClaude ? 'text-[#3a2e1f]/30 italic' : 'text-black/30 italic'
            }`}
            title={t('alarm.labelEditHint')}
          >
            {a.label || t('alarm.labelEditHint')}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        data-testid="alarm-delete"
        className={`p-1 opacity-40 hover:opacity-100 ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} rounded`}
        aria-label={t('alarm.delete')}
      >
        <Trash2 className="w-3 h-3" />
      </button>
      {firingId === a.id && (
        <button
          type="button"
          onClick={onSnooze}
          data-testid="alarm-snooze"
          className={`p-1 text-[10px] rounded ${
            isDark ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-black/15 hover:bg-black/25 text-black'
          }`}
          title={t('alarm.snooze')}
        >
          Zz 5
        </button>
      )}
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
