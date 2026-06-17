# Screensaver

A minimal fullscreen clock + widgets screensaver. React + TypeScript + Vite.

**Live:** [vibescreensaver.vercel.app](https://vibescreensaver.vercel.app)

## Features

- 5 clock styles: digital, analog, retro (7-segment), flip, casio (F-91W port)
- 6 animated wallpapers: aurora, stars, rain, geometric, mesh, fireflies
- 11 clock colors with theme-aware contrast hints
- Widgets: world clock, weather, quotes, stopwatch, pomodoro (with
  hourly focus heatmap), calendar, alarms, sleep timer, day progress
- Draggable widgets (position persisted)
- PWA: install to home screen on iOS/Android, offline support
- Dev mode: LAN QR code for phone testing (`npm run dev`)

## Scripts

```bash
npm install           # install deps
npm run dev           # dev server with LAN QR
npm run build         # tsc + vite build → dist/
npm run preview       # serve dist/ on :4173
npm run lint          # eslint
npm run test:smoke    # bash tests/smoke.sh
npm run test:e2e      # node tests/e2e.mjs
```

## Deployment

Auto-deployed to Vercel on every push to `main`. Configuration:

- Build command: `npm run build`
- Output directory: `dist`
- Project: `screensaver` under `basrurrohman-3819s-projects`
- Repo: [github.com/mimambas/screensaver](https://github.com/mimambas/screensaver)

To deploy manually: `vercel --prod`.

## PWA install

iOS: open the URL in Safari → Share → "Add to Home Screen" → opens
fullscreen standalone, no browser chrome.

Android: Chrome will prompt to install, or use the menu → "Install app".

## CI

GitHub Actions on every push to `main`:

- Lint
- Build (tsc + vite)
- Smoke (38 checks: assets, manifest, fonts, SVG segments, iOS meta)
- E2E (31 tests: Puppeteer against the preview build)
