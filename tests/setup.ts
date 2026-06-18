// Vitest setup — runs before every test file. The big win is
// `jest-dom` matchers (`toBeInTheDocument`, `toHaveTextContent`)
// plus silencing noisy console output that comes from the
// warnings we deliberately test for.

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Each test gets a fresh DOM; cleanup() unmounts any React tree
// that RTL rendered so we don't leak state between tests.
afterEach(() => {
  cleanup();
  // Clear localStorage between tests so a test that writes to
  // it doesn't bleed into the next one. We do this on the jsdom
  // window, not in afterEach closure, so the same store that
  // production code reads from is what we wipe.
  try { window.localStorage.clear(); } catch { /* noop */ }
});

// jsdom doesn't implement matchMedia. The default `false` value
// means `prefers-reduced-motion` is off; tests that care can
// override via `window.matchMedia = vi.fn(() => ({ ... }))`.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// jsdom doesn't implement HTMLMediaElement.play / .load — the
// Casio bip audio fires `audio.play()` on every transition. Stub
// it out so we don't pollute test output with NotImplementedErrors.
// We also stub AudioContext here for tests that exercise the
// ambient engine (not yet under test, but cheap to wire).
if (!window.HTMLMediaElement.prototype.play) {
  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
}
if (!window.HTMLMediaElement.prototype.load) {
  Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
    writable: true,
    value: vi.fn(),
  });
}

// jsdom doesn't implement URL.createObjectURL. The lib uses it
// to make blob: URLs the <img> can load. We stub it to return a
// stable, non-empty string so the test Image stub fires onload.
if (!URL.createObjectURL) {
  let counter = 0;
  const live = new Set<string>();
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => {
    const url = `blob:test-${++counter}`;
    live.add(url);
    return url;
  };
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = (u: string) => {
    live.delete(u);
  };
}
