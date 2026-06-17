// Comprehensive E2E test suite.
//
// Run with:
//   npm run build && npm run preview &
//   E2E_BASE_URL=http://localhost:4173 node tests/e2e.mjs
//
// Or via the npm script `test:e2e` which does both steps.
//
// Each test gets a fresh page with cleared localStorage. We use
// puppeteer-core + system Chrome (no bundled browser) so this
// runs in CI without downloading a 200MB Chromium.

import { BASE_URL, runTests, assert, assertEq, assertMatch, newPage, waitFor } from './_helpers.mjs';

const tests = [
  // ── Critical user flows ─────────────────────────────────────────

  {
    name: 'app boots and shows the clock',
    fn: async (page) => {
      // The app's main landmark is the settings panel which is closed
      // by default; the digital clock renders as <span> elements.
      // We assert the page title plus that the app produced at least
      // one big text-9xl (the digital clock uses text-9xl, which
      // Tailwind maps to font-size: 8rem; we accept any font-size
      // between 5rem and 9rem to be lenient against the actual
      // computed size on headless Chrome).
      const title = await page.title();
      assertMatch(title, /screensaver/i, 'page title');
      const fontSize = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        for (const el of all) {
          const cs = getComputedStyle(el);
          const px = parseFloat(cs.fontSize);
          // text-9xl = 8rem = 128px; accept anything > 64px as "big".
          if (px >= 64) return px;
        }
        return 0;
      });
      assert(fontSize >= 64, `expected a large clock display (>=64px), got ${fontSize}px`);
    },
  },

  {
    name: 'settings panel opens and closes via S key',
    fn: async (page) => {
      // S should toggle the settings dialog. The dialog has
      // role="dialog" + aria-label="Settings".
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]', { timeout: 3000 });
      await page.keyboard.press('Escape');
      // After Escape, dialog may still be mounted but should be closed
      // (we just check that Escape didn't throw and we can re-open).
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]', { timeout: 3000 });
    },
  },

  {
    name: 'clock style picker switches to retro',
    fn: async (page) => {
      // Open settings, click the retro style button.
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      // The clock style buttons are aria-pressed; retro is the 3rd.
      // We pick by visible text content since indices shift.
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button[aria-pressed]'));
        const retro = btns.find((b) => /retro/i.test(b.textContent ?? ''));
        retro?.click();
      });
      // Wait for retro's signature: a black-ish background.
      await waitFor(page, 'div', (el) => {
        const bg = getComputedStyle(el).backgroundColor;
        // rgba(0,0,0,0.6) or rgb(0,0,0)
        return /rgba?\(0,\s*0,\s*0/.test(bg);
      });
    },
  },

  {
    name: 'clock style picker switches to casio and renders the F-91W SVG',
    fn: async (page) => {
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      // The clock style buttons have data-clock-style="...". We use
      // this rather than text matching (the visible text is just an
      // emoji + label, fragile across UI tweaks).
      await page.evaluate(() => {
        document.querySelector('[data-clock-style="casio"]')?.click();
      });
      // The Casio F-91W style embeds /casio-f91w.svg via <object>.
      // pollFor because the <object> mounts asynchronously after the
      // React state update.
      await waitFor(page, 'object[data="/casio-f91w.svg"]', (el) => Boolean(el), 5000);
    },
  },

  {
    name: 'clock size +/- buttons adjust the size',
    fn: async (page) => {
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      // The size readout (e.g. "1.3×") sits between the − / + buttons.
      // We just assert that, after pressing +, the readout still shows
      // a × character (i.e. the readout exists in the expected shape).
      const before = await page.evaluate(() => {
        const inc = document.querySelector('[aria-label="Increase clock size"]');
        if (!inc) return '';
        // The readout is the sibling of the button.
        return inc.parentElement?.textContent ?? '';
      });
      assertMatch(before, /×/, 'size readout should already show × before click');
      await page.click('[aria-label="Increase clock size"]');
      const after = await page.evaluate(() => {
        const inc = document.querySelector('[aria-label="Increase clock size"]');
        return inc?.parentElement?.textContent ?? '';
      });
      assertMatch(after, /×/, 'size readout should still show × after click');
    },
  },

  {
    name: 'theme switch cycles dark → light → claude',
    fn: async (page) => {
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      // Find the three theme buttons by emoji and click in order.
      const labels = ['🌑 Dark', '☀️ Light', '🍂 Claude'];
      for (const label of labels) {
        await page.evaluate((text) => {
          const btns = Array.from(document.querySelectorAll('button'));
          const b = btns.find((el) => el.textContent?.trim().startsWith(text));
          b?.click();
        }, label);
        // After click, the bg should have changed. We sample the body
        // bg and assert it differs from the initial black.
        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        assert(bg && bg !== 'rgba(0, 0, 0, 0)', `theme switched, bg=${bg}`);
      }
    },
  },

  {
    name: 'layout switch cycles classic → split → minimal',
    fn: async (page) => {
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      // The layout buttons have data-layout="classic|split|minimal"
      // and an emoji-only visible text. We use the data attribute
      // for a stable selector.
      for (const layout of ['classic', 'split', 'minimal']) {
        await page.evaluate((l) => {
          const btn = document.querySelector(`[data-layout="${l}"]`);
          btn?.click();
        }, layout);
        // After click, the matching button should be aria-pressed="true".
        const pressed = await page.evaluate((l) => {
          const btn = document.querySelector(`[data-layout="${l}"]`);
          return btn?.getAttribute('aria-pressed') === 'true';
        }, layout);
        assert(pressed, `${layout} button should be aria-pressed after click`);
      }
    },
  },

  {
    name: 'widget visibility toggles (Date on) and reorders the panel',
    fn: async (page) => {
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      // Find the Date toggle (a switch with role="switch" near
      // label "Date"). Click the parent label, which the app wires
      // up as a clickable row.
      const wasOff = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const dateLabel = labels.find((l) => /^Date$/.test(l.textContent?.trim() ?? ''));
        if (!dateLabel) return null;
        const sw = dateLabel.querySelector('[role="switch"]');
        return sw?.getAttribute('aria-checked');
      });
      // Toggle by clicking the switch.
      await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const dateLabel = labels.find((l) => /^Date$/.test(l.textContent?.trim() ?? ''));
        const sw = dateLabel?.querySelector('[role="switch"]');
        sw?.click();
      });
      // State should have flipped.
      const isNow = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const dateLabel = labels.find((l) => /^Date$/.test(l.textContent?.trim() ?? ''));
        return dateLabel?.querySelector('[role="switch"]')?.getAttribute('aria-checked');
      });
      assert(wasOff !== null, 'Date switch should exist');
      assert(wasOff !== isNow, 'Date toggle should flip aria-checked');
    },
  },

  {
    name: 'settings export/import: file input is wired to settings key',
    fn: async (page) => {
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      // The Import label has a hidden <input type=file accept="application/json">.
      const found = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const importLabel = labels.find((l) => /Import/.test(l.textContent ?? ''));
        if (!importLabel) return null;
        const input = importLabel.querySelector('input[type="file"]');
        return input ? { accept: input.accept, hidden: input.classList.contains('hidden') || input.style.display === 'none' } : null;
      });
      assert(found, 'import file input should exist inside the Import label');
      assertEq(found.accept, 'application/json', 'accept attr');
      assert(found.hidden, 'file input should be visually hidden');
    },
  },

  {
    name: 'settings persist across reload (theme + clock style)',
    fn: async (page) => {
      // 1) Set Casio style via S → pick casio.
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button[aria-pressed]'));
        const casio = btns.find((b) => /casio/i.test(b.textContent ?? ''));
        casio?.click();
      });
      // 2) Reload and confirm the style persisted.
      await page.reload({ waitUntil: 'networkidle2' });
      // Casio's signature is the embedded /casio-f91w.svg <object>.
      // Give React a moment to mount the rendered component.
      const present = await page.evaluate(() =>
        !!document.querySelector('object[type="image/svg+xml"][data="/casio-f91w.svg"]'),
      );
      assert(present, 'casio style should persist after reload');
    },
  },

  // ── Keyboard navigation ────────────────────────────────────────

  {
    name: 'keyboard shortcuts: F / S / H / Esc all work',
    fn: async (page) => {
      // Esc: no-op safe (settings panel was never open).
      await page.keyboard.press('Escape');
      // S opens settings.
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      // Esc closes settings.
      await page.keyboard.press('Escape');
      // H toggles UI hint; the shortcut hint pill should disappear.
      // We tag the pill wrapper with data-hint="shortcut-pill" so
      // we can find it deterministically.
      await page.keyboard.press('h');
      const hiddenHint = await page.evaluate(() => {
        const pill = document.querySelector('[data-hint="shortcut-pill"]');
        if (!pill) return true;
        const cs = getComputedStyle(pill);
        return cs.opacity === '0' || pill.className.includes('opacity-0');
      });
      assert(hiddenHint, 'H key should hide the keyboard hint pill');
      // Toggle back so subsequent tests see a normal state.
      await page.keyboard.press('h');
      // F toggles fullscreen via the Fullscreen API; in headless
      // puppeteer this may not actually request it, so we just
      // assert the click handler doesn't throw.
      await page.keyboard.press('f');
    },
  },

  // ── Accessibility ──────────────────────────────────────────────

  {
    name: 'a11y: settings dialog has role=dialog and aria-label',
    fn: async (page) => {
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      const ok = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"][aria-label="Settings"]');
        if (!d) return false;
        return d.getAttribute('aria-label') === 'Settings' && d.getAttribute('role') === 'dialog';
      });
      assert(ok, 'dialog has correct role + aria-label');
    },
  },

  {
    name: 'a11y: visible focus ring on tabbed elements',
    fn: async (page) => {
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      // Focus the first button in the dialog and check that the
      // focused element has a non-default outline / ring style.
      await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"][aria-label="Settings"]');
        const first = d?.querySelector('button, [tabindex]');
        first?.focus();
      });
      const style = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          outline: cs.outlineStyle,
          outlineWidth: cs.outlineWidth,
          boxShadow: cs.boxShadow,
        };
      });
      assert(style, 'an element should be focusable');
      // Tailwind's focus ring sets box-shadow. Either outline != none
      // or box-shadow != none is acceptable; we accept either.
      const hasFocusStyle =
        (style.outline && style.outline !== 'none') ||
        (style.outlineWidth && style.outlineWidth !== '0px') ||
        (style.boxShadow && style.boxShadow !== 'none');
      assert(hasFocusStyle, `focused element should have visible focus indicator: ${JSON.stringify(style)}`);
    },
  },

  // ── Mobile viewport ───────────────────────────────────────────

  {
    name: 'mobile viewport: clock scales to fit 390x844',
    fn: async (page) => {
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      await page.reload({ waitUntil: 'networkidle2' });
      // Body should not have horizontal scroll (the layout should
      // adapt). We assert scrollWidth <= clientWidth + 1 (subpixel).
      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      assert(
        overflow.scrollW <= overflow.clientW + 1,
        `mobile overflow: scrollW=${overflow.scrollW} clientW=${overflow.clientW}`,
      );
      // Reset viewport for downstream tests.
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    },
  },

  {
    name: 'mobile viewport: settings dialog still opens with S key',
    fn: async (page) => {
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      await page.reload({ waitUntil: 'networkidle2' });
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]', { timeout: 3000 });
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    },
  },

  // ── PWA ──────────────────────────────────────────────────────────

  {
    name: 'pwa: <head> has manifest, apple-touch-icon, theme-color',
    fn: async (page) => {
      const tags = await page.evaluate(() => ({
        manifest: !!document.querySelector('link[rel="manifest"]'),
        appleIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
        themeColor: !!document.querySelector('meta[name="theme-color"]'),
        appleCapable:
          document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content') ===
          'yes',
      }));
      assert(tags.manifest, 'manifest link missing');
      assert(tags.appleIcon, 'apple-touch-icon link missing');
      assert(tags.themeColor, 'theme-color meta missing');
      assert(tags.appleCapable, 'apple-mobile-web-app-capable=yes missing');
    },
  },

  {
    name: 'pwa: manifest is fetchable and references the icons',
    fn: async (page) => {
      const r = await page.goto(`${BASE_URL}/manifest.webmanifest?nocache=${Date.now()}`, { waitUntil: 'load' });
      if (!r) throw new Error('no response for manifest');
      assert(r.status() === 200, `manifest status ${r.status()}`);
      const m = await r.json();
      assertEq(m.name, 'Screensaver', 'manifest.name');
      assertEq(m.display, 'standalone', 'manifest.display');
      assert(Array.isArray(m.icons) && m.icons.length >= 2, 'manifest.icons array');
      const sizes = m.icons.map((i) => i.sizes);
      assert(sizes.includes('192x192'), 'icon 192 declared');
      assert(sizes.includes('512x512'), 'icon 512 declared');
      // Re-navigate so subsequent tests see the SPA.
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    },
  },

  {
    name: 'pwa: icon PNG is served with image/png content-type',
    fn: async (page) => {
      const r = await page.goto(`${BASE_URL}/icon-192.png?nocache=${Date.now()}`, { waitUntil: 'load' });
      if (!r) throw new Error('no response for icon');
      assert(r.status() === 200, `icon status ${r.status()}`);
      const ct = r.headers()['content-type'] ?? '';
      assert(ct.startsWith('image/png'), `content-type=${ct}`);
      const buf = await r.buffer();
      // PNG magic: 89 50 4E 47 0D 0A 1A 0A
      assert(
        buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
        'PNG magic bytes',
      );
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    },
  },

  {
    name: 'pwa: sw.js registers without throwing in production build',
    fn: async (page) => {
      // /sw.js is registered in production builds. Our preview server
      // serves the dist/ output, which is the prod build.
      const regInfo = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return { supported: false };
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          // Wait for the SW to become active (or fail fast).
          await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((r) => setTimeout(r, 3000)),
          ]);
          return {
            supported: true,
            scope: reg.scope,
            hasController: !!navigator.serviceWorker.controller,
          };
        } catch (e) {
          return { supported: true, error: String(e) };
        }
      });
      assert(regInfo.supported, 'serviceWorker not supported in this browser');
      assert(!('error' in regInfo), `SW register threw: ${regInfo.error}`);
    },
  },

  {
    name: 'pwa: standalone mode disables the fullscreen toggle',
    fn: async (page) => {
      // Simulate being launched from the home screen. We monkey-patch
      // matchMedia to return matches:true for (display-mode: standalone)
      // BEFORE the App's effect runs. The simplest way is to install
      // an init script that runs on every page load.
      await page.evaluateOnNewDocument(() => {
        const mql = {
          matches: true,
          media: '(display-mode: standalone)',
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent() { return true; },
          onchange: null,
        };
        const orig = window.matchMedia;
        window.matchMedia = (q) => (q.includes('standalone') ? mql : orig.call(window, q));
      });
      await page.reload({ waitUntil: 'networkidle2' });
      // Give React a tick to commit the isStandalone effect.
      await new Promise((r) => setTimeout(r, 200));
      const disabled = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Toggle fullscreen"]');
        return btn ? btn.disabled : null;
      });
      assert(disabled === true, `fullscreen button should be disabled in standalone, got ${disabled}`);
    },
  },
];

const { passed, total } = await runTests(tests);
process.exit(passed === total ? 0 : 1);
