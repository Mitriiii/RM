import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Next.js's own compiler handles JSX at build time; vitest's esbuild transform needs to be
  // told explicitly to use the automatic runtime, or component test files fail with
  // "React is not defined" since nothing here imports React itself.
  esbuild: { jsx: 'automatic' },
  resolve: {
    // Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping, which Next.js resolves at
    // build time but vitest/vite does not read on its own.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    name: '@freyo/web',
    environment: 'node',
    // Pure lib/diagnostic logic runs under node (fast, no DOM needed). Component render
    // tests (*.test.tsx) need a DOM — jsdom — to actually mount and query React output,
    // which is the whole point of the kickoff Session 6.6 requirement for a report-render
    // regression test, not just a data-pipeline test.
    environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']],
    setupFiles: ['./vitest.setup.ts'],
  },
});
