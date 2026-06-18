// Vitest config. We split the unit tests (jsdom + happy-dom-free
// fast loop) from the e2e tests (puppeteer + real browser). The
// `environment: 'jsdom'` line is what makes RTL's `render` work —
// without it, hooks can only be tested via `renderHook`, which
// limits assertions to return values.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    css: false,
    // The main bundle imports `lucide-react` and CSS that pulls in
    // things jsdom can't parse. We exclude the build-output files.
    exclude: ['node_modules', 'dist', 'tests/e2e.mjs', 'tests/smoke.sh'],
  },
});
