// Shared helpers for tests/e2e.mjs and tests/dbg.mjs.
//
// Spawns system Chrome (already installed on macOS dev machines and
// in the CI image) headless via puppeteer-core, navigates to the
// static preview server, and exposes a small assertion API.

import puppeteer from 'puppeteer-core';

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
export const HEADLESS = process.env.E2E_HEADED !== '1';
export const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];

export async function launchBrowser() {
  for (const p of CHROME_PATHS) {
    try {
      const fs = await import('node:fs');
      if (fs.existsSync(p)) {
        return puppeteer.launch({
          executablePath: p,
          headless: HEADLESS ? 'new' : false,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        });
      }
    } catch {
      // continue
    }
  }
  return puppeteer.launch({
    headless: HEADLESS ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

// Per-test setup: navigate to BASE_URL and wipe persisted settings so
// each test starts from a known state. Returns a Page ready for use.
export async function newPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(15_000);
  // Surface page errors and console output in test logs.
  page.on('pageerror', (e) => console.error('  page error:', e.message));
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.error(`  [${type}]`, msg.text());
    }
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    try {
      // Clear our app's keys but PRESERVE language + any other keys
      // that earlier tests seeded via evaluateOnNewDocument.
      const keysToClear = [
        'screensaver.settings.v2',
        'screensaver.pomodoro.stats.v1',
        'screensaver.pomodoro.v1',
        'screensaver.worldclock.cities.v1',
        'screensaver.draggable-positions.v1',
      ];
      for (const k of keysToClear) localStorage.removeItem(k);
    } catch {
      // ignore
    }
  });
  await page.reload({ waitUntil: 'networkidle2' });
  return page;
}

// Test runner. `tests` is an array of { name, fn } where fn(page)
// performs the test and returns nothing on success, or throws on
// failure. We collect pass/fail and print a summary; exit 1 on any
// failure.
export async function runTests(tests) {
  const browser = await launchBrowser();
  const results = [];
  for (const t of tests) {
    const t0 = Date.now();
    let page;
    try {
      // Race protection: newPage occasionally fails with
      // "Session with given id not found" when the previous
      // page's close is still propagating through the SW. We
      // retry once on the first attempt.
      let attempt = 0;
      while (true) {
        try {
          page = await newPage(browser);
          break;
        } catch (e) {
          attempt += 1;
          if (attempt >= 3) throw e;
          // Wait briefly for the previous target to close.
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      await t.fn(page);
      const ms = Date.now() - t0;
      results.push({ name: t.name, pass: true, ms });
      console.log(`  ✓ ${t.name}  (${ms}ms)`);
    } catch (e) {
      const ms = Date.now() - t0;
      results.push({ name: t.name, pass: false, ms, err: e });
      console.error(`  ✗ ${t.name}  (${ms}ms)\n    ${e?.message ?? e}`);
    } finally {
      if (page) {
        try { await page.close(); } catch { /* ignore */ }
      }
    }
  }
  await browser.close();
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log('');
  console.log(`  ${passed}/${total} tests passed  (${results.reduce((s, r) => s + r.ms, 0)}ms total)`);
  return { results, passed, total };
}

// Tiny assertion helpers. They throw with a useful message on
// failure, similar to node:assert but lighter-weight.
export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
export function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${msg ? ` — ${msg}` : ''}`);
  }
}
export function assertMatch(actual, pattern, msg) {
  if (typeof pattern === 'string') {
    if (!actual.includes(pattern)) {
      throw new Error(`expected ${JSON.stringify(actual)} to include ${JSON.stringify(pattern)}${msg ? ` — ${msg}` : ''}`);
    }
  } else if (!pattern.test(actual)) {
    throw new Error(`expected ${JSON.stringify(actual)} to match ${pattern}${msg ? ` — ${msg}` : ''}`);
  }
}

// Wait until a selector satisfies a predicate. Useful for waiting
// out React renders after a state change.
export async function waitFor(page, selector, fn, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await page.$eval(selector, fn).catch(() => null);
    if (value) return value;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`timeout waiting for ${selector} to satisfy predicate`);
}

// Re-export puppeteer for callers that want Page / Browser types
// without an extra import.
export { puppeteer };
