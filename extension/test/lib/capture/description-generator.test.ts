import { describe, it, expect } from 'vitest';
import { generateDescription } from '@/lib/capture/description-generator';
import { createAction, createElementMetadata } from '../../fixtures';

describe('generateDescription', () => {
  // ─── Click actions ──────────────────────────────────────────────────────────

  it('describes clicking a link', () => {
    const action = createAction({
      actionType: 'click',
      element: createElementMetadata({ tag: 'a', text: 'Learn more' }),
    });
    expect(generateDescription(action)).toBe("Clicked link 'Learn more' on example.com (/page)");
  });

  it('describes clicking a button by tag', () => {
    const action = createAction({
      actionType: 'click',
      element: createElementMetadata({ tag: 'button', text: 'Save' }),
    });
    expect(generateDescription(action)).toBe("Clicked button 'Save' on example.com (/page)");
  });

  it('describes clicking a button by role', () => {
    const action = createAction({
      actionType: 'click',
      element: createElementMetadata({ tag: 'div', role: 'button', text: 'OK' }),
    });
    expect(generateDescription(action)).toBe("Clicked button 'OK' on example.com (/page)");
  });

  it('describes toggling a checkbox', () => {
    const action = createAction({
      actionType: 'click',
      element: createElementMetadata({
        tag: 'input',
        type: 'checkbox',
        text: '',
        role: '',
        name: 'agree',
      }),
    });
    expect(generateDescription(action)).toBe(
      "Toggled checkbox the 'agree' field on example.com (/page)",
    );
  });

  it('describes selecting a radio button', () => {
    const action = createAction({
      actionType: 'click',
      element: createElementMetadata({
        tag: 'input',
        type: 'radio',
        text: '',
        role: '',
        name: 'option',
      }),
    });
    expect(generateDescription(action)).toBe(
      "Selected radio the 'option' field on example.com (/page)",
    );
  });

  it('describes opening a dropdown', () => {
    const action = createAction({
      actionType: 'click',
      element: createElementMetadata({ tag: 'select', ariaLabel: '', role: '', text: 'Country' }),
    });
    expect(generateDescription(action)).toBe("Opened dropdown 'Country' on example.com (/page)");
  });

  it('describes clicking a generic element', () => {
    const action = createAction({
      actionType: 'click',
      element: createElementMetadata({ tag: 'div', text: '', role: '', id: 'main-panel' }),
    });
    expect(generateDescription(action)).toBe('Clicked #main-panel on example.com (/page)');
  });

  // ─── Input actions ──────────────────────────────────────────────────────────

  it('describes typing text', () => {
    const action = createAction({
      actionType: 'input',
      inputValue: 'hello world',
      element: createElementMetadata({
        tag: 'input',
        text: '',
        ariaLabel: '',
        placeholder: 'Enter name',
      }),
    });
    expect(generateDescription(action)).toBe(
      "Typed 'hello world' in the 'Enter name' field on example.com (/page)",
    );
  });

  it('masks password input', () => {
    const action = createAction({
      actionType: 'input',
      inputValue: 'secret123',
      element: createElementMetadata({
        tag: 'input',
        type: 'password',
        text: '',
        ariaLabel: '',
        placeholder: 'Password',
      }),
    });
    expect(generateDescription(action)).toBe(
      "Typed •••••••• in the 'Password' field on example.com (/page)",
    );
  });

  it('describes input with empty value', () => {
    const action = createAction({
      actionType: 'input',
      inputValue: '',
      element: createElementMetadata({
        tag: 'input',
        text: '',
        ariaLabel: '',
        placeholder: '',
        name: 'email',
      }),
    });
    expect(generateDescription(action)).toBe(
      "Typed '' in the 'email' field on example.com (/page)",
    );
  });

  // ─── Other actions ──────────────────────────────────────────────────────────

  it('describes scroll', () => {
    const action = createAction({ actionType: 'scroll' });
    expect(generateDescription(action)).toBe('Scrolled on example.com (/page)');
  });

  it('describes navigation', () => {
    const action = createAction({
      actionType: 'navigate',
      url: 'https://docs.example.com/getting-started',
    });
    expect(generateDescription(action)).toBe('Navigated to docs.example.com (/getting-started)');
  });

  it('describes form submit', () => {
    const action = createAction({ actionType: 'submit' });
    expect(generateDescription(action)).toBe('Submitted form on example.com (/page)');
  });

  it('describes hover over an element', () => {
    const action = createAction({
      actionType: 'hover',
      element: createElementMetadata({ tag: 'button', text: 'Menu' }),
    });
    expect(generateDescription(action)).toBe("Hovered over 'Menu' on example.com (/page)");
  });

  it('describes right-click on an element', () => {
    const action = createAction({
      actionType: 'contextmenu',
      element: createElementMetadata({ tag: 'div', text: 'File item', role: '' }),
    });
    expect(generateDescription(action)).toBe("Right-clicked 'File item' on example.com (/page)");
  });

  // ─── describeElement fallback chain ─────────────────────────────────────────

  it('uses ariaLabel first', () => {
    const action = createAction({
      element: createElementMetadata({ ariaLabel: 'Close dialog', text: 'X', id: 'close-btn' }),
    });
    expect(generateDescription(action)).toContain("'Close dialog'");
  });

  it('uses text when no ariaLabel', () => {
    const action = createAction({
      element: createElementMetadata({ ariaLabel: '', text: 'Sign Up' }),
    });
    expect(generateDescription(action)).toContain("'Sign Up'");
  });

  it('uses placeholder for inputs', () => {
    const action = createAction({
      element: createElementMetadata({ ariaLabel: '', text: '', placeholder: 'Search...' }),
    });
    expect(generateDescription(action)).toContain("'Search...' field");
  });

  it('uses name attribute', () => {
    const action = createAction({
      element: createElementMetadata({
        ariaLabel: '',
        text: '',
        placeholder: '',
        name: 'username',
      }),
    });
    expect(generateDescription(action)).toContain("'username' field");
  });

  it('uses id as fallback', () => {
    const action = createAction({
      element: createElementMetadata({
        ariaLabel: '',
        text: '',
        placeholder: '',
        name: '',
        id: 'submit-form',
      }),
    });
    expect(generateDescription(action)).toContain('#submit-form');
  });

  it('uses type+tag as last resort', () => {
    const action = createAction({
      element: createElementMetadata({
        ariaLabel: '',
        text: '',
        placeholder: '',
        name: '',
        id: '',
        tag: 'input',
        type: 'email',
      }),
    });
    expect(generateDescription(action)).toContain('a email input');
  });

  it('uses generic tag element as ultimate fallback', () => {
    const action = createAction({
      element: createElementMetadata({
        ariaLabel: '',
        text: '',
        placeholder: '',
        name: '',
        id: '',
        tag: 'span',
        type: '',
      }),
    });
    expect(generateDescription(action)).toContain('a span element');
  });

  // ─── getPageName ────────────────────────────────────────────────────────────

  it('shows hostname without path for root URL', () => {
    const action = createAction({ url: 'https://example.com/' });
    expect(generateDescription(action)).toContain('example.com');
    expect(generateDescription(action)).not.toContain('(/)');
  });

  it('shows hostname with path for non-root URL', () => {
    const action = createAction({ url: 'https://example.com/dashboard' });
    expect(generateDescription(action)).toContain('example.com (/dashboard)');
  });

  it('handles invalid URL gracefully', () => {
    const action = createAction({ url: 'not-a-valid-url' });
    expect(generateDescription(action)).toContain('not-a-valid-url');
  });

  // ─── truncate ───────────────────────────────────────────────────────────────

  it('truncates long text to 60 chars', () => {
    const longText = 'A'.repeat(80);
    const action = createAction({
      element: createElementMetadata({ ariaLabel: longText }),
    });
    const desc = generateDescription(action);
    // ariaLabel is truncated to 57 chars + '...' = 60
    expect(desc).toContain('A'.repeat(57) + '...');
  });

  it('does not truncate text at or under 60 chars', () => {
    const text = 'A'.repeat(60);
    const action = createAction({
      element: createElementMetadata({ ariaLabel: text }),
    });
    const desc = generateDescription(action);
    expect(desc).toContain(text);
    expect(desc).not.toContain('...');
  });
});
