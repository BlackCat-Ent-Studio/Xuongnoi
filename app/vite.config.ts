import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const page = (file: string): string => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: { main: page('./index.html'), puzzle: page('./giai-do.html') },
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
