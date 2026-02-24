import { describe, it, expect } from 'vitest';
import { exportToPuppeteer } from '@/lib/export/puppeteer-exporter';
import { createAction, createSession, createElementMetadata } from '../../fixtures';

describe('exportToPuppeteer', () => {
  it('generates a valid Puppeteer test structure', () => {
    const session = createSession({ name: 'Login Flow', url: 'https://app.example.com' });
    const actions = [createAction()];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain("const puppeteer = require('puppeteer');");
    expect(code).toContain("describe('Login Flow'");
    expect(code).toContain('let browser, page;');
    expect(code).toContain('browser = await puppeteer.launch(');
    expect(code).toContain("await page.goto('https://app.example.com'");
    expect(code).toContain('await browser.close();');
  });

  it('uses data-testid selector when available', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          selectors: { css: 'button', xpath: '//button', testId: 'submit-btn' },
        }),
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('[data-testid="submit-btn"]');
  });

  it('uses aria-label selector when available', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          ariaLabel: 'Close dialog',
          selectors: { css: 'button.close', xpath: '//button' },
        }),
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('[aria-label="Close dialog"]');
  });

  it('uses #id selector when element has id', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          id: 'email-field',
          selectors: { css: '#email-field', xpath: '//input' },
        }),
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('#email-field');
  });

  it('falls back to CSS selector', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          tag: 'div',
          text: '',
          selectors: { css: 'div.container > span', xpath: '//div/span' },
        }),
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain("'div.container > span'");
  });

  it('generates click with waitForSelector', () => {
    const session = createSession();
    const actions = [createAction({ actionType: 'click', description: 'Click submit' })];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('await page.waitForSelector(');
    expect(code).toContain('.click();');
  });

  it('generates input with type()', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'hello@test.com',
        element: createElementMetadata({ tag: 'input' }),
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain("await el1.type('hello@test.com');");
  });

  it('clears input before typing', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'text',
        element: createElementMetadata({ tag: 'input' }),
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('await el1.click({ clickCount: 3 });');
    expect(code).toContain("await el1.type('text');");
  });

  it('uses process.env.PASSWORD for password fields', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'secret',
        element: createElementMetadata({ tag: 'input', type: 'password' }),
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain("process.env.PASSWORD || ''");
    expect(code).not.toContain('secret');
  });

  it('generates scroll with evaluate', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'scroll',
        scrollPosition: { x: 0, y: 800 },
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('await page.evaluate(() => window.scrollTo(0, 800));');
  });

  it('generates navigate with page.goto', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'navigate',
        url: 'https://example.com/about',
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain("await page.goto('https://example.com/about'");
  });

  it('generates hover action', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'hover',
        element: createElementMetadata({ tag: 'button', text: 'Menu' }),
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('.hover();');
  });

  it('generates contextmenu with page.click right button', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'contextmenu',
        element: createElementMetadata({ tag: 'div' }),
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain(".click({ button: 'right' });");
  });

  it('adds step comments', () => {
    const session = createSession();
    const actions = [createAction({ sequenceNumber: 1, description: 'Click the login button' })];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('// Step 1: Click the login button');
  });

  it('includes selector confidence', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          selectors: { css: 'button', xpath: '//button', confidence: 0.88 },
        }),
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('// Selector confidence: 0.88');
  });

  it('includes decision point comment', () => {
    const session = createSession();
    const actions = [
      createAction({
        decisionPoint: {
          isDecisionPoint: true,
          reason: 'Choose plan type',
          branches: [],
        },
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('// Decision Point: Choose plan type');
  });

  it('sorts actions by sequenceNumber', () => {
    const session = createSession();
    const actions = [
      createAction({ id: 'a2', sequenceNumber: 2, description: 'Second' }),
      createAction({ id: 'a1', sequenceNumber: 1, description: 'First' }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code.indexOf('Step 1: First')).toBeLessThan(code.indexOf('Step 2: Second'));
  });

  it('escapes single quotes', () => {
    const session = createSession({ name: "It's a test" });
    const actions = [createAction()];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain("It\\'s a test");
  });

  it('adds waitForNavigation when next action has different URL', () => {
    const session = createSession();
    const actions = [
      createAction({
        id: 'a1',
        sequenceNumber: 1,
        actionType: 'click',
        url: 'https://example.com/login',
      }),
      createAction({
        id: 'a2',
        sequenceNumber: 2,
        actionType: 'click',
        url: 'https://example.com/dashboard',
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('page.waitForNavigation(');
  });

  it('uses llmDescription when available', () => {
    const session = createSession();
    const actions = [
      createAction({
        description: 'basic',
        llmDescription: 'AI-enhanced description',
      }),
    ];
    const code = exportToPuppeteer(session, actions);

    expect(code).toContain('AI-enhanced description');
  });

  it('launches with headless false by default', () => {
    const session = createSession();
    const code = exportToPuppeteer(session, []);

    expect(code).toContain('headless: false');
  });
});
