import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@freyo/shared',
    environment: 'node',
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
  },
});
