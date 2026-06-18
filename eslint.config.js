import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    // The react-refresh/only-export-components rule insists that
    // each file only export components. Our hook + provider pair
    // (useReorder + ReorderDragProvider) is a natural unit and
    // we already extracted the order store to its own file. The
    // remaining pair is a known exception; linting it in
    // isolation would force a third file for no real benefit.
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
