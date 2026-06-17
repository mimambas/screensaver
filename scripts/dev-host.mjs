#!/usr/bin/env node
// Dev-server wrapper: spawns Vite and prints a LAN URL + QR code so a
// phone on the same Wi-Fi can open the dev server without typing an
// IP address. Vite's banner already shows the localhost URL — we
// append the LAN IP and a scannable QR right after.
//
// We intentionally run Vite as a child process (stdio: inherit) so
// the existing dev experience is identical: HMR works, Ctrl-C kills
// the wrapper which kills Vite.

import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import qrcode from 'qrcode-terminal';

// Filter IPv4 addresses that are not loopback and not Docker/veth
// bridges. We pick the first stable LAN IP — en0/en1 on macOS,
// eth0/wlan0 on Linux. Falls back to localhost.
function pickLanIp() {
  const ifaces = networkInterfaces();
  for (const [name, list] of Object.entries(ifaces)) {
    if (!list) continue;
    for (const i of list) {
      if (i.family !== 'IPv4' || i.internal) continue;
      // Skip Docker bridge (172.17–172.31) and veth pairs.
      if (i.address.startsWith('172.17.') || i.address.startsWith('172.18.')) continue;
      // Prefer the wireless / en interfaces.
      if (/^(en|wlan|eth)/.test(name)) return { name, ip: i.address };
    }
  }
  // Last resort: any IPv4.
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const i of list) {
      if (i.family === 'IPv4' && !i.internal) return { name: 'lan', ip: i.address };
    }
  }
  return null;
}

const PORT = process.env.PORT || '5173';
const lan = pickLanIp();
const lanUrl = lan ? `http://${lan.ip}:${PORT}/` : null;

const child = spawn(
  'npx',
  ['vite', '--host', '0.0.0.0', '--port', PORT, ...process.argv.slice(2)],
  { stdio: 'inherit' },
);

// Print the QR once Vite has had a moment to print its banner.
setTimeout(() => {
  if (!lanUrl) {
    console.log('\n[dev-host] no LAN IP detected; phone access unavailable.\n');
    return;
  }
  console.log(`\n[dev-host] LAN: ${lanUrl}  (${lan.name})\n`);
  qrcode.generate(lanUrl, { small: true });
  console.log('  scan the QR or open the URL on a phone on the same Wi-Fi.\n');
}, 800);

const forward = (sig) => {
  child.kill(sig);
};
process.on('SIGINT', () => forward('SIGINT'));
process.on('SIGTERM', () => forward('SIGTERM'));

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
