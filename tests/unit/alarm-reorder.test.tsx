// alarm reorder unit tests. The reorder logic lives in the
// `alarm:reorder` window event listener. We dispatch the event
// directly and assert on the resulting localStorage order.
//
// The actual drag-to-drop UX is exercised in e2e (HTML5 native
// drag-and-drop is hard to script via CDP). Here we focus on the
// state-mutation logic.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AlarmList } from '../../src/widgets/AlarmList';

const STORAGE_KEY = 'screensaver.alarms.v1';

function seedAlarms(alarms: Array<{ id: string; label: string; time: string }>) {
  const full = alarms.map((a) => ({
    id: a.id,
    time: a.time,
    label: a.label,
    enabled: true,
    days: [],
    lastFired: 0,
    oneShot: false,
  }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
}

function readOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || '[]';
    return (JSON.parse(raw) as Array<{ label: string }>).map((a) => a.label);
  } catch {
    return [];
  }
}

describe('AlarmList reorder (via alarm:reorder event)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Ensure layout shows the alarms widget (the hook reads from
    // localStorage on mount, but the widget only mounts if
    // showAlarms=true in the persisted settings). We don't render
    // the widget for these tests, so we don't need to flip the
    // flag — we're testing the event listener behavior directly.
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('swap: drag id-A before id-B → A moves above B', () => {
    seedAlarms([
      { id: 'a', label: 'Wake', time: '06:00' },
      { id: 'b', label: 'Lunch', time: '12:00' },
      { id: 'c', label: 'Dinner', time: '19:00' },
    ]);
    const { unmount } = renderHook(() => AlarmList({ theme: 'dark' }));
    act(() => {
      window.dispatchEvent(new CustomEvent('alarm:reorder', {
        detail: { draggedId: 'a', targetId: 'b', before: true },
      }));
    });
    expect(readOrder()).toEqual(['Wake', 'Lunch', 'Dinner']);
    // a is still first; nothing moved because A was already above B.
    unmount();
  });

  it('swap: drag id-A after id-B → A moves below B', () => {
    seedAlarms([
      { id: 'a', label: 'Wake', time: '06:00' },
      { id: 'b', label: 'Lunch', time: '12:00' },
      { id: 'c', label: 'Dinner', time: '19:00' },
    ]);
    const { unmount } = renderHook(() => AlarmList({ theme: 'dark' }));
    act(() => {
      window.dispatchEvent(new CustomEvent('alarm:reorder', {
        detail: { draggedId: 'a', targetId: 'b', before: false },
      }));
    });
    expect(readOrder()).toEqual(['Lunch', 'Wake', 'Dinner']);
    unmount();
  });

  it('move: drag id-C (last) before id-A (first)', () => {
    seedAlarms([
      { id: 'a', label: 'Wake', time: '06:00' },
      { id: 'b', label: 'Lunch', time: '12:00' },
      { id: 'c', label: 'Dinner', time: '19:00' },
    ]);
    const { unmount } = renderHook(() => AlarmList({ theme: 'dark' }));
    act(() => {
      window.dispatchEvent(new CustomEvent('alarm:reorder', {
        detail: { draggedId: 'c', targetId: 'a', before: true },
      }));
    });
    expect(readOrder()).toEqual(['Dinner', 'Wake', 'Lunch']);
    unmount();
  });

  it('no-op: dragging onto self does nothing', () => {
    seedAlarms([
      { id: 'a', label: 'Wake', time: '06:00' },
      { id: 'b', label: 'Lunch', time: '12:00' },
    ]);
    const { unmount } = renderHook(() => AlarmList({ theme: 'dark' }));
    act(() => {
      window.dispatchEvent(new CustomEvent('alarm:reorder', {
        detail: { draggedId: 'a', targetId: 'a', before: true },
      }));
    });
    expect(readOrder()).toEqual(['Wake', 'Lunch']);
    unmount();
  });

  it('no-op: unknown ids are ignored', () => {
    seedAlarms([
      { id: 'a', label: 'Wake', time: '06:00' },
    ]);
    const { unmount } = renderHook(() => AlarmList({ theme: 'dark' }));
    act(() => {
      window.dispatchEvent(new CustomEvent('alarm:reorder', {
        detail: { draggedId: 'unknown', targetId: 'a', before: true },
      }));
    });
    expect(readOrder()).toEqual(['Wake']);
    unmount();
  });

  it('removes the event listener on unmount', () => {
    seedAlarms([
      { id: 'a', label: 'Wake', time: '06:00' },
      { id: 'b', label: 'Lunch', time: '12:00' },
    ]);
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => AlarmList({ theme: 'dark' }));
    expect(addSpy).toHaveBeenCalledWith('alarm:reorder', expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('alarm:reorder', expect.any(Function));
  });
});
