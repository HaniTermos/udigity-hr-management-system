import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Pure-logic unit tests only (src/**/*.test.ts); there is no DOM runner for components.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
