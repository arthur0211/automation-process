import { describe, it, expect } from 'vitest';
import { exportPlaywrightWithCI } from '@/lib/export/playwright-ci-exporter';
import { createAction, createSession, createElementMetadata } from '../../fixtures';

describe('exportPlaywrightWithCI', () => {
  it('generates test file with BASE_URL env var', () => {
    const session = createSession({ url: 'https://example.com' });
    const actions = [createAction()];
    const { testFile } = exportPlaywrightWithCI(session, actions);

    expect(testFile).toContain("process.env.BASE_URL || 'https://example.com'");
    // Should NOT contain the hard-coded goto pattern from the original exporter
    expect(testFile).not.toContain("await page.goto('https://example.com');");
  });

  it('generates workflow YAML with correct structure', () => {
    const session = createSession();
    const actions = [createAction()];
    const { workflowFile } = exportPlaywrightWithCI(session, actions);

    expect(workflowFile).toContain('name: Playwright Tests');
    expect(workflowFile).toContain('on:');
    expect(workflowFile).toContain('push:');
    expect(workflowFile).toContain('branches: [main]');
    expect(workflowFile).toContain('pull_request:');
    expect(workflowFile).toContain('jobs:');
    expect(workflowFile).toContain('runs-on: ubuntu-latest');
    expect(workflowFile).toContain('uses: actions/checkout@v4');
    expect(workflowFile).toContain('uses: actions/setup-node@v4');
    expect(workflowFile).toContain('node-version: 22');
    expect(workflowFile).toContain('run: npm ci');
    expect(workflowFile).toContain('run: npx playwright test');
  });

  it('uses chromium by default', () => {
    const session = createSession();
    const actions = [createAction()];
    const { workflowFile } = exportPlaywrightWithCI(session, actions);

    expect(workflowFile).toContain('npx playwright install --with-deps chromium');
  });

  it('uses configured browser', () => {
    const session = createSession();
    const actions = [createAction()];
    const { workflowFile } = exportPlaywrightWithCI(session, actions, {
      browser: 'firefox',
    });

    expect(workflowFile).toContain('npx playwright install --with-deps firefox');
    expect(workflowFile).not.toContain('chromium');
  });

  it('includes artifact upload step', () => {
    const session = createSession();
    const actions = [createAction()];
    const { workflowFile } = exportPlaywrightWithCI(session, actions);

    expect(workflowFile).toContain('uses: actions/upload-artifact@v4');
    expect(workflowFile).toContain('if: always()');
    expect(workflowFile).toContain('name: playwright-report');
    expect(workflowFile).toContain('path: playwright-report/');
  });

  it('includes Playwright install step', () => {
    const session = createSession();
    const actions = [createAction()];
    const { workflowFile } = exportPlaywrightWithCI(session, actions);

    expect(workflowFile).toContain('npx playwright install --with-deps');
  });

  it('includes test.setTimeout with default timeout', () => {
    const session = createSession();
    const actions = [createAction()];
    const { testFile } = exportPlaywrightWithCI(session, actions);

    expect(testFile).toContain('test.setTimeout(30000);');
  });

  it('uses configured timeout', () => {
    const session = createSession();
    const actions = [createAction()];
    const { testFile } = exportPlaywrightWithCI(session, actions, {
      timeout: 60000,
    });

    expect(testFile).toContain('test.setTimeout(60000);');
  });

  it('uses configured baseUrl in workflow', () => {
    const session = createSession();
    const actions = [createAction()];
    const { workflowFile } = exportPlaywrightWithCI(session, actions, {
      baseUrl: 'https://staging.example.com',
    });

    expect(workflowFile).toContain("vars.BASE_URL || 'https://staging.example.com'");
  });

  it('uses webkit browser when configured', () => {
    const session = createSession();
    const actions = [createAction()];
    const { workflowFile } = exportPlaywrightWithCI(session, actions, {
      browser: 'webkit',
    });

    expect(workflowFile).toContain('npx playwright install --with-deps webkit');
  });

  it('preserves original test structure (import, describe, steps)', () => {
    const session = createSession({ name: 'Login Flow' });
    const actions = [
      createAction({
        id: 'a1',
        sequenceNumber: 1,
        actionType: 'input',
        inputValue: 'user@test.com',
        element: createElementMetadata({ tag: 'input', placeholder: 'Email' }),
      }),
      createAction({
        id: 'a2',
        sequenceNumber: 2,
        actionType: 'click',
        description: 'Click submit',
      }),
    ];
    const { testFile } = exportPlaywrightWithCI(session, actions);

    expect(testFile).toContain("import { test, expect } from '@playwright/test';");
    expect(testFile).toContain("test.describe('Login Flow'");
    expect(testFile).toContain("await test.step('Step 1:");
    expect(testFile).toContain("await test.step('Step 2:");
    expect(testFile).toContain('.fill(testData.email);');
  });

  it('includes BASE_URL env in workflow step', () => {
    const session = createSession();
    const actions = [createAction()];
    const { workflowFile } = exportPlaywrightWithCI(session, actions);

    expect(workflowFile).toContain('env:');
    expect(workflowFile).toContain('BASE_URL:');
  });
});
