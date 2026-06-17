import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Short build hash injected into the SW cache name so a fresh build
// auto-evicts the previous cache. Falls back to a timestamp in
// detached or non-git environments (e.g. CI checkout).
const BUILD_HASH = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return String(Date.now())
  }
})()

// sw.js lives in public/ and references __BUILD_HASH__ as a runtime
// constant. Vite's `define` only rewrites code that flows through the
// JS bundler, so we walk dist/ after build and replace the token in
// any .js / .html / .json that mentions it.
function injectBuildHashPlugin() {
  return {
    name: 'inject-build-hash',
    closeBundle() {
      const root = 'dist'
      walk(root, (file: string) => {
        if (!/\.(js|html|json)$/.test(file)) return
        const text = readFileSync(file, 'utf8')
        if (text.includes('__BUILD_HASH__')) {
          writeFileSync(
            file,
            text.replaceAll('__BUILD_HASH__', JSON.stringify(BUILD_HASH)),
          )
        }
      })
    },
  }
}

function walk(dir: string, cb: (file: string) => void) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, cb)
    else cb(p)
  }
}

export default defineConfig({
  plugins: [react(), injectBuildHashPlugin()],
  define: {
    __BUILD_HASH__: JSON.stringify(BUILD_HASH),
  },
})
