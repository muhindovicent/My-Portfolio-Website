import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    extensions: ['.ts', '.js', '.mjs', '.json'],
    alias: [
      {
        find: /^(.+)\.js$/,
        replacement: '$1.ts',
      },
    ],
  },
});
