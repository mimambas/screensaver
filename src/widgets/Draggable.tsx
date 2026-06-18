// Draggable wrapper for any widget. Two modes:
//
// 1. Free-position drag (when pos is set in localStorage): grab
//    the handle, drag the widget anywhere on the screen. Position
//    is persisted per-widget-id to localStorage.
//
// 2. Reorder drag (always available, default mode): grab the
//    handle, drag the widget over a sibling, and the two swap
//    places. The new order is persisted as an array of widget
//    ids (managed by ./draggable-order — extracted to its own
//    file so the react-refresh/only-export-components rule is
//    satisfied).
//
// The reorder is the "no setup needed" mode — most users want
// to rearrange the widgets (Pomodoro above Timer, etc.) more
// than they want to position them absolutely. Free-position
// is the power-user mode: double-click the handle to enter it.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ThemeName } from './clock-constants';
import { useT } from '../i18n';
import { useReorder } from './reorder-context';

const POSITION_KEY = 'screensaver.draggable-positions.v1';

export type Position = { left: number; top: number };

// ── localStorage helpers ────────────────────────────────────────

function loadPositions(): Record<string, Position> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
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
    window.localStorage.setItem(POSITION_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
}

// ── ReorderDragContext — declared in ./reorder-context
//    (extracted for the react-refresh/only-export-components
//    rule). Re-exported here so consumers can keep importing
//    { Draggable, ReorderDragProvider, useReorder } from a
//    single module.

export { ReorderDragProvider, useReorder } from './reorder-context';

// ── Draggable component ────────────────────────────────────────

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
  const [reorderHover, setReorderHover] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseLeft: number; baseTop: number } | null>(null);
  const reorder = useReorder();

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
      const target = e.target as HTMLElement;
      if (!target.closest('[data-drag-handle]')) return;
      // Reorder mode is the default. Notify the provider so
      // siblings know to show drop targets.
      if (pos === null) {
        e.preventDefault();
        if (reorder) {
          reorder.notifyDragStart(id);
        }
        setDragging(true);
        return;
      }
      // Free-position mode: the user has explicitly positioned
      // this widget before (pos !== null). Drag = translate.
      e.preventDefault();
      const current = pos;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseLeft: current.left,
        baseTop: current.top,
      };
      setDragging(true);
    },
    [pos, reorder, id],
  );

  useEffect(() => {
    if (!dragging) return;
    if (pos === null && reorder) {
      // Reorder drag — on move, find the widget under the
      // cursor; if it's a sibling, swap places.
      const onMove = (e: PointerEvent) => {
        const els = document.elementsFromPoint(e.clientX, e.clientY);
        for (const el of els) {
          const wrap = el.closest('[data-draggable-id]') as HTMLElement | null;
          if (wrap && wrap.getAttribute('data-draggable-id') !== id) {
            const targetId = wrap.getAttribute('data-draggable-id')!;
            const targetOrder = reorder.getOrder();
            const targetIdx = targetOrder.indexOf(targetId);
            if (targetIdx >= 0) {
              reorder.notifyDrop(id, targetIdx);
              setDragging(false);
            }
            break;
          }
        }
        setReorderHover(true);
      };
      const onUp = () => {
        setDragging(false);
        setReorderHover(false);
        if (reorder) reorder.notifyDragStart('');
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      return () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
    }
    // Free-position drag — translate cursor delta to top/left.
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
  }, [dragging, pos, reorder, id]);

  // Reset to default (centered) on double-click of handle. In
  // free-position mode this drops the pos; in reorder mode the
  // widget is already at its default position so we leave it.
  const onHandleDoubleClick = useCallback(() => {
    if (pos !== null) setPos(null);
  }, [pos]);

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
  const reorderHoverClass = isDark
    ? 'ring-2 ring-white/40'
    : isClaude
    ? 'ring-2 ring-[#3a2e1f]/30'
    : 'ring-2 ring-black/30';

  return (
    <div
      data-draggable-id={id}
      data-reorder-hover={reorderHover ? 'true' : undefined}
      style={{
        position: pos ? 'fixed' : 'relative',
        left: pos?.left,
        top: pos?.top,
        zIndex: dragging ? 30 : 10,
      }}
      onPointerDown={onPointerDown}
      className={`transition-[border-color,box-shadow] duration-200 ${
        pos ? `border border-dashed rounded-2xl p-2 ${wrapperClass}` : ''
      } ${reorderHover ? reorderHoverClass : ''} ${
        dragging ? (pos ? 'cursor-grabbing' : 'cursor-grabbing opacity-80') : pos ? 'cursor-grab' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2 -mt-1">
        <span
          data-drag-handle
          onDoubleClick={onHandleDoubleClick}
          className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded cursor-grab select-none ${handleClass}`}
          title={t('draggable.handleTitle')}
        >
          ⋮⋮ {id}
        </span>
        {pos !== null && (
          <button
            type="button"
            onClick={onHandleDoubleClick}
            className={`text-[9px] px-1.5 py-0.5 rounded ${handleClass}`}
            title={t('draggable.resetTitle')}
          >
            reset
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
