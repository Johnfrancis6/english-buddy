import { defineConfig } from 'vitest/config';

// `base` must match the GitHub Pages path (see docs/BRIEF.md §6).
export default defineConfig({
  base: '/english-buddy/',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
