// Draggable wrapper for any widget. Saves the dragged position to
// localStorage under `draggable-positions.v1` keyed by widget id.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ThemeName } from './clock-constants';
import { useT } from '../i18n';

const STORAGE_KEY = 'screensaver.draggable-positions.v1';

export type Position = { left: number; top: number };

function loadPositions(): Record<string, Position> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Record<string, Position>;
  } catch {
    return {};
  }
}

function savePositions(positions: Record<string, Position>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
}

export function Draggable({
  id,
  theme = 'dark',
  children,
}: {
  id: string;
  theme?: ThemeName;
  children: ReactNode;
}) {
  const t = useT();
  const [pos, setPos] = useState<Position | null>(() => loadPositions()[id] ?? null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseLeft: number; baseTop: number } | null>(null);

  // Persist on every position change.
  useEffect(() => {
    if (pos === null) return;
    const all = loadPositions();
    all[id] = pos;
    savePositions(all);
  }, [id, pos]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only drag if the user grabbed the handle (data-drag-handle).
      if (!(e.target as HTMLElement).closest('[data-drag-handle]')) return;
      e.preventDefault();
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const current = pos ?? { left: rect.left, top: rect.top };
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseLeft: current.left,
        baseTop: current.top,
      };
      setDragging(true);
    },
    [pos],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const next = {
        left: Math.max(0, dragRef.current.baseLeft + dx),
        top: Math.max(0, dragRef.current.baseTop + dy),
      };
      setPos(next);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging]);

  // Reset to default (center-ish) on double-click of handle.
  const onHandleDoubleClick = useCallback(() => {
    setPos(null);
  }, []);

  const isDark = theme === 'dark';
  const isClaude = theme === 'claude';
  const handleClass = isDark
    ? 'bg-white/10 hover:bg-white/20 text-white/60'
    : isClaude
    ? 'bg-[#3a2e1f]/10 hover:bg-[#3a2e1f]/20 text-[#3a2e1f]/60'
    : 'bg-black/10 hover:bg-black/20 text-black/60';
  const wrapperClass = isDark
    ? 'border-white/15 hover:border-white/30'
    : isClaude
    ? 'border-[#3a2e1f]/15 hover:border-[#3a2e1f]/30'
    : 'border-black/15 hover:border-black/30';

  return (
    <div
      style={{
        position: pos ? 'fixed' : 'relative',
        left: pos?.left,
        top: pos?.top,
        zIndex: dragging ? 30 : 10,
      }}
      onPointerDown={onPointerDown}
      className={`transition-[border-color] duration-200 ${
        pos ? `border border-dashed rounded-2xl p-2 ${wrapperClass}` : ''
      } ${dragging ? 'cursor-grabbing' : pos ? 'cursor-grab' : ''}`}
    >
      {pos && (
        <div
          className="flex items-center justify-between mb-2 -mt-1"
        >
          <span
            data-drag-handle
            onDoubleClick={onHandleDoubleClick}
            className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded cursor-grab select-none ${handleClass}`}
            title={t('draggable.handleTitle')}
          >
            ⋮⋮ {id}
          </span>
          <button
            type="button"
            onClick={onHandleDoubleClick}
            className={`text-[9px] px-1.5 py-0.5 rounded ${handleClass}`}
            title={t('draggable.resetTitle')}
          >
            reset
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
