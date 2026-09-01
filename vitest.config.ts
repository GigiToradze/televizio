import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'cms/src/**/*.test.ts'],
    environment: 'node',
  },
});
