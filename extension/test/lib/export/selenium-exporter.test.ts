import { describe, it, expect } from 'vitest';
import { exportToSelenium } from '@/lib/export/selenium-exporter';
import { createAction, createSession, createElementMetadata } from '../../fixtures';

describe('exportToSelenium', () => {
  it('generates a valid Selenium WebDriver test structure', () => {
    const session = createSession({ name: 'Login Flow', url: 'https://app.example.com' });
    const actions = [createAction()];
    const code = exportToSelenium(session, actions);

    expect(code).toContain("const { Builder, By, until } = require('selenium-webdriver');");
    expect(code).toContain("describe('Login Flow'");
    expect(code).toContain("let driver;");
    expect(code).toContain("driver = await new Builder().forBrowser('chrome').build();");
    expect(code).toContain("await driver.get('https://app.example.com');");
    expect(code).toContain('await driver.quit();');
  });

  it('uses data-testid locator when available', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          selectors: { css: 'button', xpath: '//button', testId: 'submit-btn' },
        }),
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain("By.css('[data-testid=\"submit-btn\"]')");
  });

  it('uses By.id when element has an id', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          id: 'email-input',
          selectors: { css: '#email-input', xpath: '//input[@id="email-input"]' },
        }),
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain("By.id('email-input')");
  });

  it('uses By.linkText for links with text', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'click',
        element: createElementMetadata({
          tag: 'a',
          text: 'Sign Up',
          href: '/signup',
          selectors: { css: 'a.signup', xpath: '//a' },
        }),
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain("By.linkText('Sign Up')");
  });

  it('uses By.name for form elements with name attribute', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'test@example.com',
        element: createElementMetadata({
          tag: 'input',
          name: 'email',
          selectors: { css: 'input[name=email]', xpath: '//input' },
        }),
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain("By.name('email')");
  });

  it('falls back to By.css for generic elements', () => {
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
    const code = exportToSelenium(session, actions);

    expect(code).toContain("By.css('div.container > span')");
  });

  it('generates click action with wait', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'click',
        description: 'Click the submit button',
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain('await driver.wait(until.elementLocated(');
    expect(code).toContain('.click();');
  });

  it('generates input action with sendKeys', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'hello world',
        element: createElementMetadata({ tag: 'input' }),
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain('.clear();');
    expect(code).toContain(".sendKeys('hello world');");
  });

  it('uses process.env.PASSWORD for password fields', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'secret123',
        element: createElementMetadata({ tag: 'input', type: 'password' }),
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain("process.env.PASSWORD || ''");
    expect(code).not.toContain('secret123');
  });

  it('generates scroll action with executeScript', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'scroll',
        scrollPosition: { x: 0, y: 500 },
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain("await driver.executeScript('window.scrollTo(0, 500)');");
  });

  it('generates navigate action with driver.get', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'navigate',
        url: 'https://example.com/dashboard',
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain("await driver.get('https://example.com/dashboard');");
  });

  it('generates submit action', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'submit',
        element: createElementMetadata({ tag: 'form' }),
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain('.click();');
  });

  it('generates hover action with actions API', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'hover',
        element: createElementMetadata({ tag: 'button', text: 'Menu' }),
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain('driver.actions()');
    expect(code).toContain('.move(');
    expect(code).toContain('.perform();');
  });

  it('generates contextmenu action with actions API', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'contextmenu',
        element: createElementMetadata({ tag: 'div' }),
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain('driver.actions()');
    expect(code).toContain('.contextClick(');
    expect(code).toContain('.perform();');
  });

  it('adds step comments with descriptions', () => {
    const session = createSession();
    const actions = [
      createAction({
        sequenceNumber: 1,
        description: 'Click the login button',
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain('// Step 1: Click the login button');
  });

  it('includes selector confidence as comment', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          selectors: { css: 'button', xpath: '//button', confidence: 0.95 },
        }),
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain('// Selector confidence: 0.95');
  });

  it('includes decision point comment', () => {
    const session = createSession();
    const actions = [
      createAction({
        decisionPoint: {
          isDecisionPoint: true,
          reason: 'User chooses payment method',
          branches: [],
        },
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain('// Decision Point: User chooses payment method');
  });

  it('sorts actions by sequenceNumber', () => {
    const session = createSession();
    const actions = [
      createAction({ id: 'a2', sequenceNumber: 2, description: 'Second action' }),
      createAction({ id: 'a1', sequenceNumber: 1, description: 'First action' }),
    ];
    const code = exportToSelenium(session, actions);

    const firstIdx = code.indexOf('Step 1: First action');
    const secondIdx = code.indexOf('Step 2: Second action');
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it('escapes single quotes in strings', () => {
    const session = createSession({ name: "It's a test" });
    const actions = [createAction()];
    const code = exportToSelenium(session, actions);

    expect(code).toContain("It\\'s a test");
  });

  it('adds URL change wait when next action has different URL', () => {
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
    const code = exportToSelenium(session, actions);

    expect(code).toContain("await driver.wait(until.urlContains('/dashboard')");
  });

  it('uses llmDescription when available', () => {
    const session = createSession();
    const actions = [
      createAction({
        description: 'basic description',
        llmDescription: 'AI-enhanced description',
      }),
    ];
    const code = exportToSelenium(session, actions);

    expect(code).toContain('AI-enhanced description');
  });

  it('handles empty actions array', () => {
    const session = createSession();
    const code = exportToSelenium(session, []);

    expect(code).toContain("describe('Test Session'");
    expect(code).toContain("await driver.get('https://example.com');");
  });
});
