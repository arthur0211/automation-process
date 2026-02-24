import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/**/*.d.ts',
        'lib/api/gemini-client.ts',
        'lib/api/rate-limiter.ts',
        'lib/api/backend-provider.ts',
        'lib/api/enrichment-provider.ts',
        'lib/hooks/**',
        'lib/capture/event-capture.ts',
        'lib/capture/screenshot.ts',
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
