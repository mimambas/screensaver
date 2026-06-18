// Custom wallpaper storage — IndexedDB-backed blob store.
//
// Why IndexedDB, not localStorage? A photo of any reasonable
// resolution is 1-10 MB. localStorage has a 5-10 MB cap and
// storing binary data via base64 inflates it by ~33%. IndexedDB
// gives us a binary Blob store with no practical size limit
// (the browser's quota applies, but is much more generous).
//
// The store has a single record keyed on 'wallpaper-custom'. The
// shape we keep:
//   - blob: the original image (PNG / JPEG / WebP / GIF).
//   - url: an object URL the renderer uses as <img src=…>. We
//     create it on demand from the blob and revoke on unload.
//   - meta: { type, width, height, size } — populated when the
//     image is decoded, so the settings panel can show
//     "1920×1080 · 412 KB" before the user commits.
//
// The store is wrapped in a small Promise-returning API so the
// React layer can await loads.

const DB_NAME = 'screensaver';
const DB_VERSION = 1;
const STORE = 'wallpapers';
const KEY = 'wallpaper-custom';

export interface CustomWallpaperMeta {
  type: string;        // MIME (image/png, image/jpeg, ...)
  width: number;        // px
  height: number;       // px
  size: number;         // bytes
  /** Object URL cached for the lifetime of the page. */
  url: string;
  /** Original blob, in case the consumer needs to re-decode
   *  (e.g. for a different DPR or for ImageBitmap). */
  blob: Blob;
}

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function putBlob(blob: Blob, meta: { type: string; width: number; height: number }): Promise<CustomWallpaperMeta> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    // Persist the blob + meta side by side. We pack meta into a
    // JSON object so we don't need a second store.
    const record = {
      blob,
      type: meta.type,
      width: meta.width,
      height: meta.height,
      size: blob.size,
    };
    const req = store.put(record, KEY);
    req.onsuccess = () => {
      resolve({
        type: record.type,
        width: record.width,
        height: record.height,
        size: record.size,
        url: URL.createObjectURL(blob),
        blob,
      });
    };
    req.onerror = () => reject(req.error);
  });
}

async function getBlob(): Promise<CustomWallpaperMeta | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(KEY);
    req.onsuccess = () => {
      const rec = req.result as { blob: Blob; type: string; width: number; height: number; size: number } | undefined;
      if (!rec) {
        resolve(null);
        return;
      }
      resolve({
        type: rec.type,
        width: rec.width,
        height: rec.height,
        size: rec.size,
        url: URL.createObjectURL(rec.blob),
        blob: rec.blob,
      });
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteBlob(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.delete(KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── React hook ────────────────────────────────────────────────
// useCustomWallpaper — exposes a single wallpaper blob (or null).
// The hook reads from IndexedDB on mount and resolves to the
// CustomWallpaperMeta shape. It re-creates the object URL when
// the record changes; cleanup is the renderer's responsibility
// (URL.revokeObjectURL on unmount or when replacing).

import { useEffect, useState, useCallback } from 'react';

export function useCustomWallpaper(): {
  custom: CustomWallpaperMeta | null;
  loading: boolean;
  error: string | null;
  save: (blob: Blob) => Promise<CustomWallpaperMeta | null>;
  load: () => Promise<void>;
  remove: () => Promise<void>;
} {
  const [custom, setCustom] = useState<CustomWallpaperMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meta = await getBlob();
      setCustom(meta);
    } catch (e) {
      setError(String(e));
      setCustom(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (blob: Blob) => {
      setError(null);
      try {
        // Decode to get dimensions before persisting.
        const dims = await readImageDimensions(blob);
        const meta = await putBlob(blob, dims);
        // Revoke any prior URL to avoid leaking.
        setCustom((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return meta;
        });
        return meta;
      } catch (e) {
        setError(String(e));
        return null;
      }
    },
    [],
  );

  const remove = useCallback(async () => {
    setError(null);
    try {
      await deleteBlob();
      setCustom((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  // The Wallpaper component is always mounted in the app, and
  // the URL is the same as the one rendered — revoking would
  // just break the <img> tag. The URL is revoked when the user
  // replaces the wallpaper (in save) or deletes it (in remove).
  // Reference `load` so the exhaustive-deps disable above is
  // self-justifying — without this, the eslint comment and the
  // dependency array drift over time.
  void load;

  return { custom, loading, error, save, load, remove };
}

// ── Image dimension probe ─────────────────────────────────────
// HTMLImageElement.decode is the cleanest path: we read the
// blob into an <img>, await decode(), and read naturalWidth /
// naturalHeight. Works for PNG / JPEG / WebP / GIF. SVG with an
// embedded <image> is fine too; standalone .svg is treated as a
// 1×1 placeholder because the browser doesn't compute vector
// dimensions the same way.

function readImageDimensions(blob: Blob): Promise<{ type: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      if (w === 0 || h === 0) {
        // SVG without intrinsic size — fall back to a sensible
        // 1920x1080 so the meta doesn't show "0×0".
        resolve({ type: blob.type || 'image/svg+xml', width: 1920, height: 1080 });
      } else {
        resolve({ type: blob.type || 'image/png', width: w, height: h });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode failed'));
    };
    img.src = url;
  });
}

// ── Test-only: reset the database to empty. ───────────────────
export async function __resetCustomWallpaperForTests(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    await deleteBlob();
  } catch {
    /* ignore — DB may not exist yet */
  }
}
