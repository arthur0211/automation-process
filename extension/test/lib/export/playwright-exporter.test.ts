import { describe, it, expect } from 'vitest';
import { exportToPlaywright } from '@/lib/export/playwright-exporter';
import type { ActionType } from '@/lib/types';
import { createAction, createSession, createElementMetadata, createSelector } from '../../fixtures';

describe('exportToPlaywright', () => {
  it('generates valid Playwright test file structure', () => {
    const session = createSession();
    const actions = [createAction()];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("import { test, expect } from '@playwright/test';");
    expect(result).toContain("test.describe('Test Session'");
    expect(result).toContain("test('recorded flow'");
    expect(result).toContain('async ({ page })');
  });

  it('starts with page.goto using session URL', () => {
    const session = createSession({ url: 'https://myapp.com/start' });
    const actions = [createAction()];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("await page.goto('https://myapp.com/start');");
  });

  it('sorts actions by sequenceNumber', () => {
    const session = createSession();
    const actions = [
      createAction({ id: 'a3', sequenceNumber: 3, description: 'Third' }),
      createAction({ id: 'a1', sequenceNumber: 1, description: 'First' }),
      createAction({ id: 'a2', sequenceNumber: 2, description: 'Second' }),
    ];
    const result = exportToPlaywright(session, actions);

    const firstIdx = result.indexOf('Step 1: First');
    const secondIdx = result.indexOf('Step 2: Second');
    const thirdIdx = result.indexOf('Step 3: Third');
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  it('generates click action', () => {
    const session = createSession();
    const actions = [createAction({ actionType: 'click' })];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('.click();');
  });

  it('generates input action with fill', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'hello@test.com',
        element: createElementMetadata({ tag: 'input', placeholder: 'Email' }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    // Input value is parameterized into testData
    expect(result).toContain("email: 'hello@test.com',");
    expect(result).toContain('.fill(testData.email);');
  });

  it('generates scroll action with scrollTo', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'scroll',
        scrollPosition: { x: 0, y: 500 },
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('await page.evaluate(() => window.scrollTo(0, 500));');
  });

  it('generates navigate action with goto', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'navigate',
        url: 'https://example.com/next',
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("await page.goto('https://example.com/next');");
  });

  it('generates submit action as click', () => {
    const session = createSession();
    const actions = [createAction({ actionType: 'submit' })];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('.click();');
  });

  it('generates hover action with page.hover()', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'hover',
        element: createElementMetadata({
          tag: 'button',
          role: 'button',
          text: 'Menu',
          ariaLabel: '',
          selectors: createSelector({ testId: 'menu-btn' }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("page.getByTestId('menu-btn')");
    expect(result).toContain('.hover();');
    expect(result).toContain('toBeVisible()');
    // hover() should come after toBeVisible()
    const visibleIdx = result.indexOf('toBeVisible()');
    const hoverIdx = result.indexOf('.hover()');
    expect(visibleIdx).toBeLessThan(hoverIdx);
  });

  it('generates contextmenu action with right-click', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'contextmenu',
        element: createElementMetadata({
          tag: 'div',
          role: '',
          text: 'File item',
          ariaLabel: '',
          selectors: createSelector({ testId: undefined, css: '.file-item' }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("page.getByText('File item')");
    expect(result).toContain(".click({ button: 'right' });");
    expect(result).toContain('toBeVisible()');
  });

  it('uses getByTestId when testId is available', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          selectors: createSelector({ testId: 'submit-btn' }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("page.getByTestId('submit-btn')");
  });

  it('uses getByRole when role and text are present', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          role: 'button',
          text: 'Submit',
          ariaLabel: '',
          selectors: createSelector({ testId: undefined }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("page.getByRole('button', { name: 'Submit' })");
  });

  it('uses getByLabel when ariaLabel is present', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          role: '',
          text: '',
          ariaLabel: 'Close dialog',
          selectors: createSelector({ testId: undefined }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("page.getByLabel('Close dialog')");
  });

  it('uses getByPlaceholder for input with placeholder', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          tag: 'input',
          role: '',
          text: '',
          ariaLabel: '',
          placeholder: 'Enter email',
          selectors: createSelector({ testId: undefined }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("page.getByPlaceholder('Enter email')");
  });

  it('falls back to CSS locator', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          role: '',
          text: '',
          ariaLabel: '',
          placeholder: '',
          selectors: createSelector({ testId: undefined, css: '#main-form' }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("page.locator('#main-form')");
  });

  it('includes decision point comment', () => {
    const session = createSession();
    const actions = [
      createAction({
        decisionPoint: {
          isDecisionPoint: true,
          reason: 'User chooses plan type',
          branches: [],
        },
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('// Decision Point: User chooses plan type');
  });

  it('includes confidence comment', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          selectors: createSelector({ confidence: 0.95 }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('// Selector confidence: 0.95');
  });

  it('escapes single quotes in input values', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: "it's a test",
        element: createElementMetadata({ tag: 'input', placeholder: 'Name' }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("it\\'s a test");
  });

  it('truncates text over 50 chars and falls back from getByRole', () => {
    const longText = 'A'.repeat(51);
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          role: 'button',
          text: longText,
          ariaLabel: '',
          selectors: createSelector({ testId: undefined, css: '.long-btn' }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    // Should not use getByRole because text > 50 chars
    expect(result).not.toContain('getByRole');
    // Should fall back to CSS locator (text > 30 chars, so getByText also skipped)
    expect(result).toContain("page.locator('.long-btn')");
  });

  it('uses getByRole with name for aria-label element with role', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          role: 'button',
          text: '',
          ariaLabel: 'Close dialog',
          selectors: createSelector({ testId: undefined }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("page.getByRole('button', { name: 'Close dialog' })");
  });

  it('adds waitForLoadState after navigate action', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'navigate',
        url: 'https://example.com/next',
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("await page.goto('https://example.com/next');");
    expect(result).toContain("await page.waitForLoadState('networkidle');");
  });

  it('adds expect().toBeVisible() before click', () => {
    const session = createSession();
    const actions = [createAction({ actionType: 'click' })];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('toBeVisible()');
    expect(result).toContain('.click()');
    // toBeVisible should come before click
    const visibleIdx = result.indexOf('toBeVisible()');
    const clickIdx = result.indexOf('.click()');
    expect(visibleIdx).toBeLessThan(clickIdx);
  });

  it('uses getByText for short text without role', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          role: '',
          text: 'Learn more',
          ariaLabel: '',
          placeholder: '',
          selectors: createSelector({ testId: undefined, css: 'a.link' }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("page.getByText('Learn more')");
  });

  it('adds waitForLoadState after initial page.goto', () => {
    const session = createSession({ url: 'https://app.test' });
    const actions = [createAction()];
    const result = exportToPlaywright(session, actions);

    // The initial goto should be followed by waitForLoadState
    const gotoIdx = result.indexOf("await page.goto('https://app.test')");
    const waitIdx = result.indexOf("await page.waitForLoadState('networkidle')");
    expect(gotoIdx).toBeGreaterThan(-1);
    expect(waitIdx).toBeGreaterThan(gotoIdx);
  });

  it('adds comment for unsupported action type', () => {
    const session = createSession();
    // Force an unsupported action type via cast
    const actions = [createAction({ actionType: 'unknown' as unknown as ActionType })];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('// Unsupported action type: unknown');
  });

  // ─── test.step() blocks ──────────────────────────────────────────────────

  it('wraps each action in a test.step() block', () => {
    const session = createSession();
    const actions = [createAction({ description: 'Clicked the submit button' })];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("await test.step('Step 1: Clicked the submit button', async () => {");
    expect(result).toContain('    });');
  });

  it('wraps multiple actions in separate test.step() blocks', () => {
    const session = createSession();
    const actions = [
      createAction({ id: 'a1', sequenceNumber: 1, description: 'First action' }),
      createAction({ id: 'a2', sequenceNumber: 2, description: 'Second action' }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("await test.step('Step 1: First action', async () => {");
    expect(result).toContain("await test.step('Step 2: Second action', async () => {");
  });

  it('uses llmDescription over description in test.step() label', () => {
    const session = createSession();
    const actions = [
      createAction({
        description: 'Clicked button',
        llmDescription: 'Click the login button to authenticate',
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('Step 1: Click the login button to authenticate');
    expect(result).not.toContain('Step 1: Clicked button');
  });

  it('escapes single quotes in test.step() description', () => {
    const session = createSession();
    const actions = [createAction({ description: "Click the 'Submit' button" })];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("Step 1: Click the \\'Submit\\' button");
  });

  // ─── testData parameterization ──────────────────────────────────────────

  it('generates testData object for input actions', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'john@example.com',
        element: createElementMetadata({ tag: 'input', placeholder: 'Email address' }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('const testData = {');
    expect(result).toContain("emailAddress: 'john@example.com',");
    expect(result).toContain('.fill(testData.emailAddress);');
  });

  it('generates testData keys from ariaLabel when no placeholder', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'John',
        element: createElementMetadata({
          tag: 'input',
          placeholder: '',
          ariaLabel: 'First name',
          selectors: createSelector({ testId: undefined }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("firstName: 'John',");
    expect(result).toContain('.fill(testData.firstName);');
  });

  it('generates testData keys from element name when no placeholder or ariaLabel', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'doe',
        element: createElementMetadata({
          tag: 'input',
          placeholder: '',
          ariaLabel: '',
          name: 'last-name',
          selectors: createSelector({ testId: undefined }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("lastName: 'doe',");
    expect(result).toContain('.fill(testData.lastName);');
  });

  it('generates fallback testData key from index', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'something',
        element: createElementMetadata({
          tag: 'input',
          placeholder: '',
          ariaLabel: '',
          name: '',
          role: '',
          text: '',
          selectors: createSelector({ testId: undefined, css: 'input.custom' }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("input1: 'something',");
    expect(result).toContain('.fill(testData.input1);');
  });

  it('does not generate testData when there are no input actions', () => {
    const session = createSession();
    const actions = [createAction({ actionType: 'click' })];
    const result = exportToPlaywright(session, actions);

    expect(result).not.toContain('const testData');
  });

  it('generates multiple testData entries for multiple inputs', () => {
    const session = createSession();
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
        actionType: 'input',
        inputValue: 'secret123',
        element: createElementMetadata({ tag: 'input', placeholder: 'Password', type: 'password' }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('const testData = {');
    expect(result).toContain("email: 'user@test.com',");
    // Password should use process.env
    expect(result).toContain("password: process.env.PASSWORD ?? '',");
  });

  // ─── Password field handling ──────────────────────────────────────────────

  it('uses process.env.PASSWORD for password input fields', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: '••••••',
        element: createElementMetadata({
          tag: 'input',
          type: 'password',
          placeholder: 'Password',
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("password: process.env.PASSWORD ?? '',");
    expect(result).toContain('.fill(testData.password);');
    expect(result).not.toContain("'••••••'");
  });

  it('uses process.env.PASSWORD regardless of input value for password type', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'actualPassword123',
        element: createElementMetadata({
          tag: 'input',
          type: 'password',
          placeholder: 'Enter password',
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("enterPassword: process.env.PASSWORD ?? '',");
    expect(result).not.toContain('actualPassword123');
  });

  // ─── waitForURL on navigation ─────────────────────────────────────────────

  it('adds waitForURL after click when next action has different URL', () => {
    const session = createSession();
    const actions = [
      createAction({
        id: 'a1',
        sequenceNumber: 1,
        actionType: 'click',
        url: 'https://example.com/login',
        description: 'Click login',
      }),
      createAction({
        id: 'a2',
        sequenceNumber: 2,
        actionType: 'click',
        url: 'https://example.com/dashboard',
        description: 'Click settings',
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("await page.waitForURL('https://example.com/dashboard');");
  });

  it('does not add waitForURL when next action has the same URL', () => {
    const session = createSession();
    const actions = [
      createAction({
        id: 'a1',
        sequenceNumber: 1,
        actionType: 'click',
        url: 'https://example.com/page',
        description: 'Click first',
      }),
      createAction({
        id: 'a2',
        sequenceNumber: 2,
        actionType: 'click',
        url: 'https://example.com/page',
        description: 'Click second',
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).not.toContain('waitForURL');
  });

  it('does not add waitForURL for the last action (no next action)', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'click',
        url: 'https://example.com/page',
        description: 'Click something',
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).not.toContain('waitForURL');
  });

  it('adds waitForURL after submit when next action has different URL', () => {
    const session = createSession();
    const actions = [
      createAction({
        id: 'a1',
        sequenceNumber: 1,
        actionType: 'submit',
        url: 'https://example.com/form',
        description: 'Submit form',
      }),
      createAction({
        id: 'a2',
        sequenceNumber: 2,
        actionType: 'click',
        url: 'https://example.com/success',
        description: 'Click continue',
      }),
    ];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain("await page.waitForURL('https://example.com/success');");
  });

  it('does not add waitForURL for non-click/submit actions', () => {
    const session = createSession();
    const actions = [
      createAction({
        id: 'a1',
        sequenceNumber: 1,
        actionType: 'input',
        inputValue: 'test',
        url: 'https://example.com/page1',
        element: createElementMetadata({ tag: 'input', placeholder: 'Search' }),
      }),
      createAction({
        id: 'a2',
        sequenceNumber: 2,
        actionType: 'click',
        url: 'https://example.com/page2',
        description: 'Click next',
      }),
    ];
    const result = exportToPlaywright(session, actions);

    // waitForURL should NOT be inside the input step
    // It should only appear if a click/submit triggers the navigation
    const inputStepMatch = result.match(
      /await test\.step\('Step 1:.*?', async \(\) => \{([\s\S]*?)\}\);/,
    );
    expect(inputStepMatch).toBeTruthy();
    expect(inputStepMatch![1]).not.toContain('waitForURL');
  });

  // ─── Integration: full flow ───────────────────────────────────────────────

  it('generates a complete test with all features combined', () => {
    const session = createSession({ name: 'Login Flow', url: 'https://app.com/login' });
    const actions = [
      createAction({
        id: 'a1',
        sequenceNumber: 1,
        actionType: 'input',
        inputValue: 'admin@app.com',
        url: 'https://app.com/login',
        description: 'Enter email',
        element: createElementMetadata({
          tag: 'input',
          placeholder: 'Email',
          type: 'email',
        }),
      }),
      createAction({
        id: 'a2',
        sequenceNumber: 2,
        actionType: 'input',
        inputValue: 'secret',
        url: 'https://app.com/login',
        description: 'Enter password',
        element: createElementMetadata({
          tag: 'input',
          placeholder: 'Password',
          type: 'password',
        }),
      }),
      createAction({
        id: 'a3',
        sequenceNumber: 3,
        actionType: 'click',
        url: 'https://app.com/login',
        description: 'Click login button',
        element: createElementMetadata({
          tag: 'button',
          role: 'button',
          text: 'Log in',
          selectors: createSelector({ testId: 'login-btn' }),
        }),
      }),
      createAction({
        id: 'a4',
        sequenceNumber: 4,
        actionType: 'click',
        url: 'https://app.com/dashboard',
        description: 'Click profile',
        element: createElementMetadata({
          tag: 'a',
          role: 'link',
          text: 'Profile',
          selectors: createSelector({ testId: undefined }),
        }),
      }),
    ];
    const result = exportToPlaywright(session, actions);

    // Structure
    expect(result).toContain("test.describe('Login Flow'");
    expect(result).toContain("await page.goto('https://app.com/login');");

    // testData
    expect(result).toContain('const testData = {');
    expect(result).toContain("email: 'admin@app.com',");
    expect(result).toContain("password: process.env.PASSWORD ?? '',");

    // test.step blocks
    expect(result).toContain("await test.step('Step 1: Enter email', async () => {");
    expect(result).toContain("await test.step('Step 2: Enter password', async () => {");
    expect(result).toContain("await test.step('Step 3: Click login button', async () => {");
    expect(result).toContain("await test.step('Step 4: Click profile', async () => {");

    // Parameterized inputs
    expect(result).toContain('.fill(testData.email);');
    expect(result).toContain('.fill(testData.password);');

    // waitForURL after login click (page changes from /login to /dashboard)
    expect(result).toContain("await page.waitForURL('https://app.com/dashboard');");

    // No secret value leaked
    expect(result).not.toContain("'secret'");
  });
});
