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

    expect(result).toContain(".fill('hello@test.com');");
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
    const actions = [createAction({ actionType: 'hover' as unknown as ActionType })];
    const result = exportToPlaywright(session, actions);

    expect(result).toContain('// Unsupported action type: hover');
  });
});
