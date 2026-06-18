// Draggable order store — extracted from Draggable.tsx so the
// rule `react-refresh/only-export-components` is happy. The
// store is the process-singleton state that LayoutClassic (and
// any future consumer) reads via `useDraggableOrder`.
//
// API:
//   - useDraggableOrder() — React hook returning the current
//     order array (re-renders on change).
//   - reorderDraggable(id, targetIndex) — move `id` to position
//     `targetIndex` in the order. Idempotent.
//   - __resetOrderStoreForTests() — wipe the singleton state.

import { useEffect, useState } from 'react';

const ORDER_KEY = 'screensaver.draggable-order.v1';

function loadOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    return [];
  }
}

function saveOrder(order: string[]) {
  try {
    window.localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch {
    // ignore
  }
}

type Listener = (order: string[]) => void;
let _order: string[] = [];
const _listeners = new Set<Listener>();

function emit() {
  for (const l of _listeners) l(_order);
}

function setOrderInternal(next: string[]) {
  _order = next;
  saveOrder(next);
  emit();
}

function ensureOrderLoaded() {
  if (_order.length === 0) {
    const loaded = loadOrder();
    if (loaded.length > 0) _order = loaded;
  }
}

export function useDraggableOrder(): string[] {
  ensureOrderLoaded();
  const [order, setOrderState] = useState<string[]>(_order);
  useEffect(() => {
    const l: Listener = (next) => setOrderState([...next]);
    _listeners.add(l);
    return () => {
      _listeners.delete(l);
    };
  }, []);
  return order;
}
/** Move `id` to `targetIndex` in the order. Clamps to valid range. */
export function reorderDraggable(id: string, targetIndex: number): void {
  ensureOrderLoaded();
  const next = _order.filter((x) => x !== id);
  const clamped = Math.max(0, Math.min(targetIndex, next.length));
  next.splice(clamped, 0, id);
  setOrderInternal(next);
}

/** Test-only: reset the singleton state. */
export function __resetOrderStoreForTests(): void {
  _order = [];
  _listeners.clear();
}
