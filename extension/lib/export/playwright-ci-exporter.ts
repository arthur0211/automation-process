import type { CapturedAction, RecordingSession } from '../types';
import { exportToPlaywright } from './playwright-exporter';

export interface PlaywrightCIConfig {
  baseUrl?: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  timeout?: number;
}

export interface PlaywrightCIExport {
  testFile: string;
  workflowFile: string;
}

const DEFAULT_CONFIG: Required<PlaywrightCIConfig> = {
  baseUrl: 'http://localhost:3000',
  browser: 'chromium',
  timeout: 30000,
};

/**
 * Patch the generated Playwright test to read baseURL from the BASE_URL env var
 * instead of hard-coding the session URL.
 */
function patchTestForCI(
  original: string,
  session: RecordingSession,
  config: Required<PlaywrightCIConfig>,
): string {
  // Replace the hardcoded goto with one that reads BASE_URL env var
  const escapedUrl = session.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const gotoPattern = new RegExp(
    `await page\\.goto\\('${escapedUrl}'\\);`,
  );
  const patched = original.replace(
    gotoPattern,
    `await page.goto(process.env.BASE_URL || '${session.url}');`,
  );

  // Add test.setTimeout if a custom timeout is configured
  const timeoutLine = `    test.setTimeout(${config.timeout});\n`;
  return patched.replace(
    "test('recorded flow', async ({ page }) => {\n",
    `test('recorded flow', async ({ page }) => {\n${timeoutLine}`,
  );
}

function generateWorkflow(config: Required<PlaywrightCIConfig>): string {
  return `name: Playwright Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx playwright install --with-deps ${config.browser}
      - run: npx playwright test
        env:
          BASE_URL: \${{ vars.BASE_URL || '${config.baseUrl}' }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
`;
}

export function exportPlaywrightWithCI(
  session: RecordingSession,
  actions: CapturedAction[],
  config?: PlaywrightCIConfig,
): PlaywrightCIExport {
  const merged: Required<PlaywrightCIConfig> = { ...DEFAULT_CONFIG, ...config };

  const original = exportToPlaywright(session, actions);
  const testFile = patchTestForCI(original, session, merged);
  const workflowFile = generateWorkflow(merged);

  return { testFile, workflowFile };
}
