import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['web/src/test/setup.ts'],
    include: ['web/src/**/*.test.{ts,tsx}'],
  },
});
