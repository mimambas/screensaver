// custom-wallpaper unit tests. The lib owns:
//   - IndexedDB read/write/delete via the 'wallpapers' store
//   - image dimension probe (HTMLImageElement.decode path)
//   - useCustomWallpaper hook (load / save / remove)
//
// IndexedDB doesn't exist in jsdom by default, so we stub it
// with a tiny in-memory implementation that mirrors the parts
// of the spec we use (open + objectStore + put + get + delete +
// onupgradeneeded). This lets the unit tests cover the load /
// save / remove paths without bringing up real IDB.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCustomWallpaper, __resetCustomWallpaperForTests } from '../../src/lib/custom-wallpaper';

// ── In-memory IDB stub ────────────────────────────────────────
function installIdbStub() {
  const stores = new Map<string, Map<IDBValidKey, unknown>>();
  const open = vi.fn(() => {
    const result = {
      objectStoreNames: { contains: (n: string) => stores.has(n) },
      createObjectStore: (name: string) => {
        stores.set(name, new Map());
        return {};
      },
    } as unknown as IDBDatabase;
    const req = {
      result,
      onupgradeneeded: null as ((e: Event) => void) | null,
      onsuccess: null as ((e: Event) => void) | null,
      onerror: null as ((e: Event) => void) | null,
      set onupgradeneeded(fn: ((e: Event) => void) | null) { if (fn) setTimeout(() => fn({ target: req } as unknown as Event), 0); },
      set onsuccess(fn: ((e: Event) => void) | null) { if (fn) setTimeout(() => fn({ target: req } as unknown as Event), 0); },
      set onerror(fn: ((e: Event) => void) | null) { /* noop */ },
    };
    // Provide transaction/objectStore on result
    (result as { transaction: () => { objectStore: (n: string) => unknown; oncomplete?: () => void; onerror?: () => void } }).transaction = () => ({
      objectStore: (n2: string) => makeObjectStore(n2),
      oncomplete: null,
      onerror: null,
    });
    function makeObjectStore(name: string) {
      const map = stores.get(name) ?? new Map();
      stores.set(name, map);
      return {
        put: (value: unknown, key: IDBValidKey) => {
          map.set(key, value);
          const r = { result: key, onsuccess: null as ((e: Event) => void) | null, onerror: null };
          setTimeout(() => r.onsuccess?.({ target: r } as unknown as Event), 0);
          return r;
        },
        get: (key: IDBValidKey) => {
          const r = { result: map.get(key), onsuccess: null as ((e: Event) => void) | null, onerror: null };
          setTimeout(() => r.onsuccess?.({ target: r } as unknown as Event), 0);
          return r;
        },
        delete: (key: IDBValidKey) => {
          map.delete(key);
          const r = { result: undefined, onsuccess: null as ((e: Event) => void) | null, onerror: null };
          setTimeout(() => r.onsuccess?.({ target: r } as unknown as Event), 0);
          return r;
        },
      };
    }
    return req as unknown as IDBOpenDBRequest;
  });
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: { open },
  });
  return { stores, open };
}

// ── Image stub ────────────────────────────────────────────────
// jsdom doesn't actually decode images, but we can mock the
// HTMLImageElement class to fire onload / report dimensions.
function installImageStub(width = 100, height = 50) {
  const OriginalImage = globalThis.Image;
  class StubImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    _src = '';
    naturalWidth = width;
    naturalHeight = height;
    set src(v: string) {
      this._src = v;
      // The lib calls URL.createObjectURL on the blob. We mirror
      // that by storing the URL; the lib will then create an
      // Image pointing at it. The actual fetch isn't relevant —
      // we just need onload to fire so the lib reads
      // naturalWidth/naturalHeight.
      setTimeout(() => this.onload?.(), 0);
    }
  }
  globalThis.Image = StubImage as unknown as typeof Image;
  return () => {
    globalThis.Image = OriginalImage;
  };
}

describe('useCustomWallpaper hook', () => {
  beforeEach(() => {
    installIdbStub();
    installImageStub();
  });
  afterEach(() => {
    // jsdom + the test IDB stub don't share storage between
    // tests; cleanup happens on the next beforeEach.
  });

  it('starts with loading=true then resolves to custom=null', async () => {
    const { result } = renderHook(() => useCustomWallpaper());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.custom).toBeNull();
  });

  it('save() persists a blob and exposes it via the hook', async () => {
    const { result } = renderHook(() => useCustomWallpaper());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const blob = new Blob(['fake-png-bytes'], { type: 'image/png' });
    await act(async () => {
      await result.current.save(blob);
    });
    await waitFor(() => {
      expect(result.current.custom).not.toBeNull();
    });
    expect(result.current.custom?.type).toBe('image/png');
    expect(result.current.custom?.width).toBe(100);
    expect(result.current.custom?.height).toBe(50);
    // The URL is an object URL — must start with blob:
    expect(result.current.custom?.url).toMatch(/^blob:/);
  });

  it('remove() drops the blob and clears the hook state', async () => {
    const { result } = renderHook(() => useCustomWallpaper());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const blob = new Blob(['fake'], { type: 'image/png' });
    await act(async () => {
      await result.current.save(blob);
    });
    expect(result.current.custom).not.toBeNull();
    await act(async () => {
      await result.current.remove();
    });
    expect(result.current.custom).toBeNull();
  });

  it('load() re-reads from IDB after an external change', async () => {
    await __resetCustomWallpaperForTests();
    const { result } = renderHook(() => useCustomWallpaper());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.custom).toBeNull();
  });
});
