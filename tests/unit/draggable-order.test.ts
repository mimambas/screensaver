// draggable-order unit tests. The store is a process-singleton
// that owns the widget order. Tests cover: load from storage,
// reorder logic, default fall-back, JSON corruption handling,
// and the test-only reset path.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  useDraggableOrder,
  reorderDraggable,
  __resetOrderStoreForTests,
} from '../../src/widgets/draggable-order';
import { renderHook, act } from '@testing-library/react';

const STORAGE_KEY = 'screensaver.draggable-order.v1';

describe('draggable-order store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetOrderStoreForTests();
  });
  afterEach(() => {
    window.localStorage.clear();
    __resetOrderStoreForTests();
  });

  it('returns an empty array when storage is empty', () => {
    const { result } = renderHook(() => useDraggableOrder());
    expect(result.current).toEqual([]);
  });

  it('loads an existing order from localStorage', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['timer', 'pomodoro']));
    const { result } = renderHook(() => useDraggableOrder());
    expect(result.current).toEqual(['timer', 'pomodoro']);
  });

  it('reorderDraggable moves an item to a new index', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['a', 'b', 'c', 'd']));
    // Ensure the hook has loaded the order so the store is in sync.
    renderHook(() => useDraggableOrder());
    reorderDraggable('a', 3);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw!)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('reorderDraggable to a negative index clamps to 0', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['a', 'b', 'c']));
    renderHook(() => useDraggableOrder());
    reorderDraggable('c', -5);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw!)).toEqual(['c', 'a', 'b']);
  });

  it('reorderDraggable past the end clamps to the end', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['a', 'b', 'c']));
    renderHook(() => useDraggableOrder());
    reorderDraggable('a', 999);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw!)).toEqual(['b', 'c', 'a']);
  });

  it('reorderDraggable with an unknown id appends it', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['a', 'b']));
    renderHook(() => useDraggableOrder());
    reorderDraggable('z', 1);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw!)).toEqual(['a', 'z', 'b']);
  });

  it('falls back to [] on malformed JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useDraggableOrder());
    expect(result.current).toEqual([]);
  });

  it('filters out non-string entries', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['a', 42, null, 'b']));
    const { result } = renderHook(() => useDraggableOrder());
    expect(result.current).toEqual(['a', 'b']);
  });

  it('hook re-renders on reorder (via the listener)', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['a', 'b']));
    const { result } = renderHook(() => useDraggableOrder());
    expect(result.current).toEqual(['a', 'b']);
    act(() => {
      reorderDraggable('a', 1);
    });
    expect(result.current).toEqual(['b', 'a']);
  });
});
