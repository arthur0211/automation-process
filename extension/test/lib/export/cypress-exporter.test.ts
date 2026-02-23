import { describe, it, expect } from 'vitest';
import { exportToCypress } from '@/lib/export/cypress-exporter';
import type { ActionType } from '@/lib/types';
import { createAction, createSession, createElementMetadata, createSelector } from '../../fixtures';

describe('exportToCypress', () => {
  it('generates basic click test', () => {
    const session = createSession();
    const actions = [createAction({ actionType: 'click' })];
    const result = exportToCypress(session, actions);

    expect(result).toContain("describe('Test Session'");
    expect(result).toContain("it('recorded flow'");
    expect(result).toContain("cy.visit('https://example.com');");
    expect(result).toContain('.click();');
  });

  it('generates input with type and clear', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'hello@test.com',
        element: createElementMetadata({ tag: 'input', placeholder: 'Email' }),
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain(".clear().type('hello@test.com');");
  });

  it('uses data-testid when available', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          selectors: createSelector({ testId: 'submit-btn' }),
        }),
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain('cy.get(\'[data-testid="submit-btn"]\')');
  });

  it('falls back to contains for text', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          text: 'Learn more',
          ariaLabel: '',
          selectors: createSelector({ testId: undefined, css: 'a.link' }),
        }),
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain("cy.contains('Learn more')");
  });

  it('falls back to aria-label selector', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          text: '',
          ariaLabel: 'Close dialog',
          selectors: createSelector({ testId: undefined }),
        }),
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain('cy.get(\'[aria-label="Close dialog"]\')');
  });

  it('falls back to CSS selector', () => {
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          text: '',
          ariaLabel: '',
          placeholder: '',
          selectors: createSelector({ testId: undefined, css: '#main-form' }),
        }),
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain("cy.get('#main-form')");
  });

  it('handles password with Cypress.env', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'input',
        inputValue: 'secret123',
        element: createElementMetadata({
          tag: 'input',
          type: 'password',
          placeholder: 'Password',
        }),
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain("Cypress.env('PASSWORD')");
    expect(result).not.toContain('secret123');
  });

  it('generates navigation with cy.visit', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'navigate',
        url: 'https://example.com/next',
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain("cy.visit('https://example.com/next');");
  });

  it('handles scroll actions', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'scroll',
        scrollPosition: { x: 0, y: 500 },
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain('cy.scrollTo(0, 500);');
  });

  it('handles empty actions', () => {
    const session = createSession();
    const result = exportToCypress(session, []);

    expect(result).toContain("describe('Test Session'");
    expect(result).toContain("cy.visit('https://example.com');");
    // Should not contain any step comments
    expect(result).not.toContain('// Step 1');
  });

  it('handles hover with trigger mouseover', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'hover',
        element: createElementMetadata({
          tag: 'button',
          role: 'button',
          text: 'Menu',
          selectors: createSelector({ testId: 'menu-btn' }),
        }),
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain(".trigger('mouseover')");
  });

  it('handles contextmenu with rightclick', () => {
    const session = createSession();
    const actions = [
      createAction({
        actionType: 'contextmenu',
        element: createElementMetadata({
          tag: 'div',
          text: 'File item',
          selectors: createSelector({ testId: undefined, css: '.file-item' }),
        }),
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain('.rightclick();');
  });

  it('sorts actions by sequenceNumber', () => {
    const session = createSession();
    const actions = [
      createAction({ id: 'a3', sequenceNumber: 3, description: 'Third' }),
      createAction({ id: 'a1', sequenceNumber: 1, description: 'First' }),
      createAction({ id: 'a2', sequenceNumber: 2, description: 'Second' }),
    ];
    const result = exportToCypress(session, actions);

    const firstIdx = result.indexOf('Step 1: First');
    const secondIdx = result.indexOf('Step 2: Second');
    const thirdIdx = result.indexOf('Step 3: Third');
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  it('adds url assertion after click when next action has different URL', () => {
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
    const result = exportToCypress(session, actions);

    expect(result).toContain("cy.url().should('include', '/dashboard');");
  });

  it('does not add url assertion when next action has same URL', () => {
    const session = createSession();
    const actions = [
      createAction({
        id: 'a1',
        sequenceNumber: 1,
        actionType: 'click',
        url: 'https://example.com/page',
      }),
      createAction({
        id: 'a2',
        sequenceNumber: 2,
        actionType: 'click',
        url: 'https://example.com/page',
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).not.toContain('cy.url()');
  });

  it('uses should be.visible before click', () => {
    const session = createSession();
    const actions = [createAction({ actionType: 'click' })];
    const result = exportToCypress(session, actions);

    expect(result).toContain(".should('be.visible').click();");
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
    const result = exportToCypress(session, actions);

    expect(result).toContain('// Selector confidence: 0.95');
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
    const result = exportToCypress(session, actions);

    expect(result).toContain('// Decision Point: User chooses plan type');
  });

  it('uses llmDescription over description', () => {
    const session = createSession();
    const actions = [
      createAction({
        description: 'Clicked button',
        llmDescription: 'Click the login button to authenticate',
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).toContain('Step 1: Click the login button to authenticate');
    expect(result).not.toContain('Step 1: Clicked button');
  });

  it('handles unsupported action type', () => {
    const session = createSession();
    const actions = [createAction({ actionType: 'unknown' as unknown as ActionType })];
    const result = exportToCypress(session, actions);

    expect(result).toContain('// Unsupported action type: unknown');
  });

  it('skips text longer than 50 chars for contains and falls back', () => {
    const longText = 'A'.repeat(51);
    const session = createSession();
    const actions = [
      createAction({
        element: createElementMetadata({
          text: longText,
          ariaLabel: '',
          selectors: createSelector({ testId: undefined, css: '.long-btn' }),
        }),
      }),
    ];
    const result = exportToCypress(session, actions);

    expect(result).not.toContain('cy.contains');
    expect(result).toContain("cy.get('.long-btn')");
  });

  it('generates a complete login flow test', () => {
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
    const result = exportToCypress(session, actions);

    // Structure
    expect(result).toContain("describe('Login Flow'");
    expect(result).toContain("cy.visit('https://app.com/login');");

    // Input with clear().type()
    expect(result).toContain(".clear().type('admin@app.com');");

    // Password uses Cypress.env
    expect(result).toContain("Cypress.env('PASSWORD')");
    expect(result).not.toContain("'secret'");

    // Click with testId
    expect(result).toContain('cy.get(\'[data-testid="login-btn"]\')');

    // URL assertion after login click (page changes)
    expect(result).toContain("cy.url().should('include', '/dashboard');");

    // Contains for text-based locator
    expect(result).toContain("cy.contains('Profile')");
  });
});
