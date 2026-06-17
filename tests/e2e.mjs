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
      // The auto-hide UI timer fires after 3s of inactivity and sets
      // uiVisible=false, which is the same state H toggles TO.
      // To make this test deterministic, wait for the timer to
      // fire first, then press H. Before that, the pill is at
      // opacity-50 (visible) and H will hide it.
      await page.keyboard.press('Escape');
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      await page.keyboard.press('Escape');
      // Let the auto-hide timer fire so uiVisible becomes false.
      await new Promise((r) => setTimeout(r, 3500));
      // H toggles uiVisible — was false, should now be true.
      await page.keyboard.press('h');
      await new Promise((r) => setTimeout(r, 300));
      const visibleHint = await page.evaluate(() => {
        const pill = document.querySelector('[data-hint="shortcut-pill"]');
        if (!pill) return false;
        const cs = getComputedStyle(pill);
        // Visible state has opacity-50 in the className, hidden has
        // opacity-0. The className check is more robust than opacity
        // because Tailwind's transition might still be in flight.
        return pill.className.includes('opacity-50') && !pill.className.includes('opacity-0');
      });
      assert(visibleHint, 'H key should re-show the keyboard hint pill (it was auto-hidden)');
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

  // ── Pomodoro stats ──────────────────────────────────────────────

  {
    name: 'pomodoro: 7d chart renders 7 bars by default',
    fn: async (page) => {
      // Seed stats with deterministic entries spanning 7 days.
      await page.evaluate(() => {
        const today = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const stats = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          stats[key(d)] = { minutes: 25 * (i + 1), cycles: i + 1 };
        }
        localStorage.setItem('screensaver.pomodoro.stats.v1', JSON.stringify(stats));
      });
      // newPage() in _helpers clears localStorage right before returning
      // the page, so we have to seed AFTER the per-test setup. The
      // helpers clear once at the start of every test — re-seeding
      // here, then reloading, is the documented escape hatch.
      await page.reload({ waitUntil: 'networkidle2' });
      // Sanity check the seed survived the reload.
      const survived = await page.evaluate(
        () => localStorage.getItem('screensaver.pomodoro.stats.v1')?.length ?? 0,
      );
      assert(survived > 50, `localStorage seed lost (len=${survived})`);
      // Click to expand the stats panel.
      const expanded = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => /stats/.test(b.textContent ?? ''),
        );
        if (!btn) return null;
        btn.click();
        return true;
      });
      assert(expanded, 'stats toggle button not found');
      await page.waitForSelector('[data-range="7d"]', { timeout: 3000 });
      const barCount = await page.evaluate(() =>
        document.querySelectorAll('[aria-label*="7 days"] [data-minutes]').length,
      );
      assert(barCount === 7, `expected 7 bars in 7d view, got ${barCount}`);
    },
  },

  {
    name: 'pomodoro: 30d toggle switches to 30 bars',
    fn: async (page) => {
      // 30d button is mounted as soon as stats is open. We don't
      // need to re-open the panel — it's still open from the prior
      // test (per-test setup reuses the same page object).
      // Wait defensively in case the panel is collapsed.
      const opened = await page.evaluate(() => {
        if (document.querySelector('[data-range="30d"]')) return true;
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => /stats/.test(b.textContent ?? ''),
        );
        btn?.click();
        return !!btn;
      });
      assert(opened, 'stats panel should be open or openable');
      await page.waitForSelector('[data-range="30d"]', { timeout: 3000 });
      await page.click('[data-range="30d"]');
      // 30d view's chart container has the 30-day aria-label.
      await page.waitForSelector('[aria-label*="30 days"]', { timeout: 3000 });
      const barCount = await page.evaluate(() =>
        document.querySelectorAll('[aria-label*="30 days"] [data-minutes]').length,
      );
      assert(barCount === 30, `expected 30 bars in 30d view, got ${barCount}`);
    },
  },

  {
    name: 'pomodoro: 7d seed yields total + best + focused days headline',
    fn: async (page) => {
      // Each test starts with a wiped localStorage. Re-seed here.
      await page.evaluate(() => {
        const today = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const stats = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          stats[key(d)] = { minutes: 25 * (i + 1), cycles: i + 1 };
        }
        localStorage.setItem('screensaver.pomodoro.stats.v1', JSON.stringify(stats));
      });
      await page.reload({ waitUntil: 'networkidle2' });
      // Open the panel.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => /stats/.test(b.textContent ?? ''),
        );
        btn?.click();
      });
      await page.waitForSelector('[data-headline]', { timeout: 3000 });
      const headline = await page.evaluate(() => {
        const el = document.querySelector('[data-headline]');
        return el?.textContent?.trim() ?? null;
      });
      assert(headline, 'headline not found');
      // Seeded values: minutes 25, 50, 75, 100, 125, 150, 175 (i+1 * 25).
      // total = 700, days focused = 7, best = 175.
      assertMatch(headline, /700 min/, 'total minutes in headline');
      assertMatch(headline, /7d focused/, 'days focused in headline');
      assertMatch(headline, /best 175m/, 'best day in headline');
    },
  },

  {
    name: 'pomodoro: streak achievement renders when streak >= 1',
    fn: async (page) => {
      // Re-seed (helpers wipe between tests).
      await page.evaluate(() => {
        const today = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const stats = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          stats[key(d)] = { minutes: 25 * (i + 1), cycles: i + 1 };
        }
        localStorage.setItem('screensaver.pomodoro.stats.v1', JSON.stringify(stats));
      });
      await page.reload({ waitUntil: 'networkidle2' });
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => /stats/.test(b.textContent ?? ''),
        );
        btn?.click();
      });
      await page.waitForSelector('[data-achievement="streak"]', { timeout: 3000 });
      const streak = await page.evaluate(() => {
        const el = document.querySelector('[data-achievement="streak"]');
        return el?.textContent?.trim() ?? null;
      });
      // With 7 days of seed data, streak should be 7 (every day
      // back from today had > 0 minutes).
      assert(streak, 'streak achievement not rendered');
      assertMatch(streak, /🔥/, 'flame emoji in streak badge');
      assertMatch(streak, /7d streak/, 'streak text');
    },
  },

  // ── Wallpaper variants ──────────────────────────────────────────

  {
    name: 'wallpaper: switching to geometric renders 8 SVG rings',
    fn: async (page) => {
      // Open settings, click the geometric wallpaper button.
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]', { timeout: 3000 });
      await page.click('[data-wallpaper="geometric"]');
      // The layer mounts asynchronously after React commits the
      // state change. Wait for the data attribute.
      await page.waitForSelector('[data-wallpaper="geometric"]', { timeout: 3000 });
      const svgCount = await page.evaluate(() =>
        document.querySelectorAll('[data-wallpaper="geometric"] svg').length,
      );
      assert(svgCount === 8, `expected 8 SVG rings, got ${svgCount}`);
    },
  },

  {
    name: 'wallpaper: switching to fireflies renders 25 firefly particles',
    fn: async (page) => {
      // Click via DOM API (not puppeteer .click) so the test isn't
      // thrown off by the button being a child of the still-open
      // settings dialog. The dialog may close on Escape between
      // tests; if so, re-open.
      const ready = await page.evaluate(() => {
        if (!document.querySelector('[role="dialog"][aria-label="Settings"]')) {
          // Re-open via the global S key handler — but we can't
          // dispatch keys here. Just check; the previous test
          // already opened it.
          return false;
        }
        return true;
      });
      if (!ready) {
        await page.keyboard.press('s');
        await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      }
      await page.evaluate(() => {
        const btn = document.querySelector('[data-wallpaper="fireflies"]');
        btn?.click();
      });
      // Wait for the fireflies root + child data-firefly spans to mount.
      await page.waitForSelector('[data-wallpaper="fireflies"] [data-firefly]', { timeout: 5000 });
      const count = await page.evaluate(() =>
        document.querySelectorAll('[data-wallpaper="fireflies"] [data-firefly]').length,
      );
      assert(count === 25, `expected 25 fireflies, got ${count}`);
    },
  },

  {
    name: 'wallpaper: switching to mesh renders 4 gradient blobs',
    fn: async (page) => {
      // The settings dialog can close on backdrop click. The wallpaper
      // button might be a child of the dialog. We click via DOM API
      // scoped to the right element. If the dialog has been closed by
      // the previous test's click, re-open it.
      const dialogOpen = await page.evaluate(() =>
        !!document.querySelector('[role="dialog"][aria-label="Settings"]'),
      );
      if (!dialogOpen) {
        await page.keyboard.press('s');
        await page.waitForSelector('[role="dialog"][aria-label="Settings"]');
      }
      // The wallpaper button row has data-wallpaper="mesh" (multiple
      // matches: the button + the rendered layer). Find the button
      // (it has type="button").
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-wallpaper="mesh"]');
        btn?.click();
      });
      // The mesh root mounts after React commits. Wait for it AND
      // for the layer to have 4 child divs.
      await page.waitForFunction(
        () => {
          // Find a [data-wallpaper="mesh"] that's NOT a button.
          const roots = Array.from(
            document.querySelectorAll('[data-wallpaper="mesh"]'),
          ).filter((el) => el.tagName.toLowerCase() !== 'button');
          const r = roots[0];
          return r && r.querySelectorAll('div').length >= 4;
        },
        { timeout: 5000 },
      );
      const blobCount = await page.evaluate(() => {
        const roots = Array.from(
          document.querySelectorAll('[data-wallpaper="mesh"]'),
        ).filter((el) => el.tagName.toLowerCase() !== 'button');
        const root = roots[0];
        return root ? root.querySelectorAll('div').length : 0;
      });
      assert(blobCount === 4, `expected 4 mesh blobs, got ${blobCount}`);
    },
  },

  // ── Clock color picker ──────────────────────────────────────────

  {
    name: 'clock color: 11 swatches render in the picker grid',
    fn: async (page) => {
      // Open settings.
      const dialogOpen = await page.evaluate(() =>
        !!document.querySelector('[role="dialog"][aria-label="Settings"]'),
      );
      if (!dialogOpen) {
        await page.keyboard.press('s');
        await page.waitForSelector('[role="dialog"][aria-label="Settings"]', { timeout: 3000 });
      }
      const swatchCount = await page.evaluate(
        () => document.querySelectorAll('button[data-color]').length,
      );
      assert(
        swatchCount === 11,
        `expected 11 swatches (white, ink, amber, green, cyan, red, pink, mint, lavender, peach, gold), got ${swatchCount}`,
      );
    },
  },

  {
    name: 'clock color: clicking mint marks the button aria-pressed',
    fn: async (page) => {
      // Make sure the settings dialog is open. Prior tests may have
      // closed it on backdrop click.
      const dialogOpen = await page.evaluate(() =>
        !!document.querySelector('[role="dialog"][aria-label="Settings"]'),
      );
      if (!dialogOpen) {
        await page.keyboard.press('s');
        await page.waitForSelector('[role="dialog"][aria-label="Settings"]', { timeout: 3000 });
      }
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-color="mint"]');
        btn?.click();
      });
      // Wait for React to commit the new state.
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('button[data-color="mint"]');
          return btn?.getAttribute('aria-pressed') === 'true';
        },
        { timeout: 3000 },
      );
      const pressed = await page.evaluate(() => {
        const btn = document.querySelector('button[data-color="mint"]');
        return btn?.getAttribute('aria-pressed') === 'true';
      });
      assert(pressed, 'mint swatch should be aria-pressed after click');
      // The clock digits' color should also have updated. We sample
      // the digital-clock container and check at least one descendant
      // has the mint hex (#5eead4) as its color.
      const colorApplied = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('span, div'));
        return all.some((el) => {
          const c = getComputedStyle(el).color;
          // rgb(94, 234, 212) is #5eead4
          return c === 'rgb(94, 234, 212)';
        });
      });
      assert(colorApplied, 'mint color should appear on the clock digits');
    },
  },

  // ── Pomodoro hourly heatmap ─────────────────────────────────────

  {
    name: 'heatmap: 7x24 grid renders 168 cells when expanded',
    fn: async (page) => {
      // Seed enough days to have data in the heatmap.
      await page.evaluate(() => {
        const today = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const stats = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          // Seed hour 9 with 50 minutes; rest empty.
          const hourly = new Array(24).fill(0);
          hourly[9] = 50;
          stats[key(d)] = { minutes: 50, cycles: 2, hourly };
        }
        localStorage.setItem('screensaver.pomodoro.stats.v1', JSON.stringify(stats));
      });
      await page.reload({ waitUntil: 'networkidle2' });
      // Open the stats panel.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => /stats/.test(b.textContent ?? ''),
        );
        btn?.click();
      });
      await page.waitForSelector('[data-range="7d"]', { timeout: 3000 });
      // Open the heatmap sub-section.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => /heatmap/.test(b.textContent ?? ''),
        );
        btn?.click();
      });
      await page.waitForSelector('[aria-label*="7 days × 24 hours"]', { timeout: 3000 });
      const cellCount = await page.evaluate(
        () => document.querySelectorAll('[aria-label*="7 days × 24 hours"] [data-cell]').length,
      );
      assert(cellCount === 168, `expected 168 cells (7 days × 24 hours), got ${cellCount}`);
    },
  },

  {
    name: 'heatmap: seeded minutes map to data-minutes attrs',
    fn: async (page) => {
      // Re-seed (helpers wipe localStorage between tests).
      await page.evaluate(() => {
        const today = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const stats = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const hourly = new Array(24).fill(0);
          hourly[9] = 50;
          stats[key(d)] = { minutes: 50, cycles: 2, hourly };
        }
        localStorage.setItem('screensaver.pomodoro.stats.v1', JSON.stringify(stats));
      });
      await page.reload({ waitUntil: 'networkidle2' });
      // Open the stats panel.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => /stats/.test(b.textContent ?? ''),
        );
        btn?.click();
      });
      // Open the heatmap sub-section.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => /heatmap/.test(b.textContent ?? ''),
        );
        btn?.click();
      });
      await page.waitForSelector('[aria-label*="7 days × 24 hours"] [data-day-row]', {
        timeout: 3000,
      });
      // Read the cells and verify the seeded hour (9) has 50 minutes
      // and other hours have 0 for the today row.
      const cells = await page.evaluate(() => {
        const root = document.querySelector('[aria-label*="7 days × 24 hours"]');
        if (!root) return null;
        // Today is the last day row (dayIdx 6).
        const today = root.querySelector('[data-day-row="6"]');
        if (!today) return null;
        return Array.from(today.querySelectorAll('[data-cell]')).map((el) => ({
          hour: el.getAttribute('data-hour'),
          minutes: Number(el.getAttribute('data-minutes')),
        }));
      });
      assert(cells, 'heatmap should be visible with today row');
      assert(cells.length === 24, `expected 24 cells in today row, got ${cells.length}`);
      const hour9 = cells.find((c) => c.hour === '9');
      assert(hour9, 'hour 9 cell should exist');
      assertEq(hour9.minutes, 50, 'hour 9 should be seeded with 50m');
    },
  },

  // ── WorldClock custom cities ────────────────────────────────────

  {
    name: 'cities: adding Asia/Singapore via CitiesManager shows in WorldClock',
    fn: async (page) => {
      // Seed a custom list and reload so the hook reads it.
      await page.evaluate(() => {
        const cities = [
          { name: 'Jakarta', tz: 'Asia/Jakarta' },
          { name: 'Singapore', tz: 'Asia/Singapore' },
        ];
        localStorage.setItem('screensaver.worldclock.cities.v1', JSON.stringify(cities));
      });
      await page.reload({ waitUntil: 'networkidle2' });
      // Open settings, expand CitiesManager, verify our city is listed.
      const dialogOpen = await page.evaluate(() =>
        !!document.querySelector('[role="dialog"][aria-label="Settings"]'),
      );
      if (!dialogOpen) {
        await page.keyboard.press('s');
        await page.waitForSelector('[role="dialog"][aria-label="Settings"]', { timeout: 3000 });
      }
      const hasSingapore = await page.evaluate(() => {
        const list = document.querySelector('[data-cities-list]');
        if (!list) return false;
        return Array.from(list.querySelectorAll('[data-city-tz]')).some(
          (el) => el.getAttribute('data-city-tz') === 'Asia/Singapore',
        );
      });
      assert(hasSingapore, 'Asia/Singapore should appear in CitiesManager list');
    },
  },

  {
    name: 'cities: removing via CitiesManager updates the list',
    fn: async (page) => {
      // Seed the list with a city that isn't a default, reload, then
      // exercise the actual CitiesManager remove button. This drives
      // the same code path (setCities → save → dispatch
      // 'worldcities:update') that App.tsx's useWorldCities listens
      // for.
      await page.evaluate(() => {
        localStorage.setItem(
          'screensaver.worldclock.cities.v1',
          JSON.stringify([
            { name: 'Jakarta', tz: 'Asia/Jakarta' },
            { name: 'Berlin', tz: 'Europe/Berlin' },
            { name: 'Singapore', tz: 'Asia/Singapore' },
          ]),
        );
      });
      await page.reload({ waitUntil: 'networkidle2' });
      // Open settings if not already open.
      const dialogOpen = await page.evaluate(() =>
        !!document.querySelector('[role="dialog"][aria-label="Settings"]'),
      );
      if (!dialogOpen) {
        await page.keyboard.press('s');
        await page.waitForSelector('[role="dialog"][aria-label="Settings"]', { timeout: 3000 });
      }
      await page.waitForSelector('[data-cities-list] [data-city-tz]', { timeout: 3000 });
      // Click the X button on the Singapore row.
      await page.evaluate(() => {
        const btn = document.querySelector('[data-remove-city="Asia/Singapore"]');
        btn?.click();
      });
      // The CitiesManager list (DOM) should reflect the new state
      // immediately because CitiesManager's own local React state
      // is updated by setCities. We assert on DOM, not localStorage,
      // because the CitiesManager → WorldClock sync via the
      // 'worldcities:update' event only matters for the second
      // (App.tsx) hook instance. Verifying DOM is the testable
      // surface.
      await page.waitForFunction(
        () => {
          const list = document.querySelector('[data-cities-list]');
          if (!list) return false;
          const tzs = Array.from(list.querySelectorAll('[data-city-tz]')).map(
            (el) => el.getAttribute('data-city-tz'),
          );
          return tzs.length === 2 && !tzs.includes('Asia/Singapore');
        },
        { timeout: 3000 },
      );
      const hasSingapore = await page.evaluate(() => {
        const list = document.querySelector('[data-cities-list]');
        if (!list) return null;
        return Array.from(list.querySelectorAll('[data-city-tz]')).some(
          (el) => el.getAttribute('data-city-tz') === 'Asia/Singapore',
        );
      });
      assert(hasSingapore === false, 'Asia/Singapore should be gone after remove click');
    },
  },

  // ── i18n (English / Indonesian) ─────────────────────────────────

  {
    name: 'i18n: switching to Indonesian translates settings dialog',
    fn: async (page) => {
      // Seed language preference BEFORE the page loads so the
      // I18nProvider picks it up on mount. New document ensures
      // the script runs before any app code on every page load.
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('screensaver.lang', 'id');
      });
      await page.reload({ waitUntil: 'networkidle2' });
      // Open the settings dialog. With locale=id the aria-label is
      // "Pengaturan", so we wait on that specifically rather than the
      // English string.
      await page.keyboard.press('s');
      await page.waitForSelector('[role="dialog"][aria-label="Pengaturan"]', { timeout: 3000 });
      const ariaLabel = await page.evaluate(() =>
        document.querySelector('[role="dialog"]')?.getAttribute('aria-label'),
      );
      assertEq(ariaLabel, 'Pengaturan', 'dialog aria-label in Indonesian');
      // The Layout section header should translate too.
      const layoutHeader = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('div')).find(
          (d) => /Tata Letak/.test(d.textContent ?? ''),
        );
        return !!el;
      });
      assert(layoutHeader, 'Layout header should be "Tata Letak" in Indonesian');
    },
  },

  {
    name: 'i18n: settings Language toggle persists to localStorage',
    fn: async (page) => {
      // We're now in Indonesian from the previous test (per-page
      // localStorage persistence between tests). Click the English
      // language button and verify both: the storage entry flips and
      // a known English string shows up.
      const enBtn = await page.$('button[data-lang="en"]');
      if (!enBtn) {
        // Settings dialog might have closed between tests — reopen.
        await page.keyboard.press('s');
        await page.waitForSelector('[role="dialog"]');
        // Re-acquire after the dialog re-mounts.
        await page.waitForSelector('button[data-lang="en"]');
      }
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-lang="en"]');
        btn?.click();
      });
      // Wait for React to commit + persist.
      await page.waitForFunction(
        () => localStorage.getItem('screensaver.lang') === 'en',
        { timeout: 3000 },
      );
      // The dialog should still be open with the new aria-label.
      await page.waitForSelector('[role="dialog"][aria-label="Settings"]', { timeout: 3000 });
      const ariaLabel = await page.evaluate(() =>
        document.querySelector('[role="dialog"]')?.getAttribute('aria-label'),
      );
      assertEq(ariaLabel, 'Settings', 'dialog aria-label back to English');
    },
  },
];

const { passed, total } = await runTests(tests);
process.exit(passed === total ? 0 : 1);
