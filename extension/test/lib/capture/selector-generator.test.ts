import { describe, it, expect, beforeEach } from 'vitest';
import { generateSelectors } from '@/lib/capture/selector-generator';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('generateSelectors', () => {
  // ─── XPath generation ───────────────────────────────────────────────────────

  describe('xpath', () => {
    it('generates XPath for a simple element', () => {
      document.body.innerHTML = '<div><button>OK</button></div>';
      const el = document.querySelector('button')!;
      const { xpath } = generateSelectors(el);
      expect(xpath).toBe('/html/body/div/button');
    });

    it('generates XPath with sibling index', () => {
      document.body.innerHTML = '<div><span>A</span><span>B</span></div>';
      const el = document.querySelectorAll('span')[1];
      const { xpath } = generateSelectors(el);
      expect(xpath).toBe('/html/body/div/span[2]');
    });

    it('generates XPath for deeply nested element', () => {
      document.body.innerHTML = '<main><section><article><p>Deep</p></article></section></main>';
      const el = document.querySelector('p')!;
      const { xpath } = generateSelectors(el);
      expect(xpath).toBe('/html/body/main/section/article/p');
    });
  });

  // ─── CSS selector priority cascade ──────────────────────────────────────────

  describe('css — priority cascade', () => {
    it('uses data-testid as highest priority', () => {
      document.body.innerHTML = '<button data-testid="submit-btn" id="btn1">Go</button>';
      const el = document.querySelector('button')!;
      const { css } = generateSelectors(el);
      expect(css).toBe('button[data-testid="submit-btn"]');
    });

    it('uses data-test-id variant when data-testid absent', () => {
      document.body.innerHTML = '<button data-test-id="alt-btn" id="btn2">Go</button>';
      const el = document.querySelector('button')!;
      const { css } = generateSelectors(el);
      expect(css).toBe('button[data-test-id="alt-btn"]');
    });

    it('falls back to ID when data-testid is not unique', () => {
      document.body.innerHTML =
        '<button data-testid="btn" id="unique">A</button><button data-testid="btn">B</button>';
      const el = document.querySelector('#unique')!;
      const { css } = generateSelectors(el);
      expect(css).toBe('#unique');
    });

    it('uses ID when present', () => {
      document.body.innerHTML = '<button id="submit">OK</button>';
      const el = document.querySelector('#submit')!;
      const { css } = generateSelectors(el);
      expect(css).toBe('#submit');
    });

    it('uses aria-label when unique and no ID', () => {
      document.body.innerHTML = '<button aria-label="Close dialog">X</button>';
      const el = document.querySelector('button')!;
      const { css } = generateSelectors(el);
      // CSS.escape escapes the space in "Close dialog"
      expect(css).toContain('button[aria-label="Close');
      expect(css).toContain('dialog"]');
    });

    it('uses unique class combination when no ID or aria-label', () => {
      document.body.innerHTML = '<div class="card primary">Content</div>';
      const el = document.querySelector('div.card')!;
      const { css } = generateSelectors(el);
      expect(css).toBe('div.card.primary');
    });

    it('filters framework classes (js-, ng-, v-, _, css-, sc-, emotion-)', () => {
      document.body.innerHTML =
        '<div class="js-hook ng-scope v-cloak _internal css-abc sc-xyz emotion-123 real-class">X</div>';
      const el = document.querySelector('div')!;
      const { css } = generateSelectors(el);
      // Only real-class should survive filtering
      expect(css).toBe('div.real-class');
    });

    it('uses name attribute when no ID, aria-label, or unique classes', () => {
      document.body.innerHTML = '<input name="email" />';
      const el = document.querySelector('input')!;
      const { css } = generateSelectors(el);
      expect(css).toBe('input[name="email"]');
    });

    it('falls back to nth-of-type path when nothing else matches', () => {
      document.body.innerHTML = '<div><span></span><span></span></div>';
      const el = document.querySelectorAll('span')[1];
      const { css } = generateSelectors(el);
      expect(css).toContain('nth-of-type');
    });
  });

  // ─── role and testId ────────────────────────────────────────────────────────

  describe('role and testId', () => {
    it('includes role when present', () => {
      document.body.innerHTML = '<div role="navigation" id="nav">Nav</div>';
      const el = document.querySelector('#nav')!;
      const selectors = generateSelectors(el);
      expect(selectors.role).toBe('navigation');
    });

    it('includes testId from data-testid', () => {
      document.body.innerHTML = '<button data-testid="submit-btn" id="btn">Go</button>';
      const el = document.querySelector('#btn')!;
      const selectors = generateSelectors(el);
      expect(selectors.testId).toBe('submit-btn');
    });

    it('includes testId from data-test-id variant', () => {
      document.body.innerHTML = '<button data-test-id="alt-btn" id="btn2">Go</button>';
      const el = document.querySelector('#btn2')!;
      const selectors = generateSelectors(el);
      expect(selectors.testId).toBe('alt-btn');
    });

    it('omits role and testId when absent', () => {
      document.body.innerHTML = '<div id="plain">Plain</div>';
      const el = document.querySelector('#plain')!;
      const selectors = generateSelectors(el);
      expect(selectors.role).toBeUndefined();
      expect(selectors.testId).toBeUndefined();
    });
  });

  // ─── confidence scoring ───────────────────────────────────────────────────

  describe('confidence scoring', () => {
    it('assigns 0.95 for data-testid selector', () => {
      document.body.innerHTML = '<button data-testid="submit">Go</button>';
      const { confidence } = generateSelectors(document.querySelector('button')!);
      expect(confidence).toBe(0.95);
    });

    it('assigns 0.90 for ID selector', () => {
      document.body.innerHTML = '<button id="submit">Go</button>';
      const { confidence } = generateSelectors(document.querySelector('button')!);
      expect(confidence).toBe(0.9);
    });

    it('assigns 0.85 for aria-label selector', () => {
      document.body.innerHTML = '<button aria-label="Close">X</button>';
      const { confidence } = generateSelectors(document.querySelector('button')!);
      expect(confidence).toBe(0.85);
    });

    it('assigns 0.80 for name selector', () => {
      document.body.innerHTML = '<input name="email" />';
      const { confidence } = generateSelectors(document.querySelector('input')!);
      expect(confidence).toBe(0.8);
    });

    it('assigns 0.20 for nth-of-type fallback', () => {
      document.body.innerHTML = '<div><span></span><span></span></div>';
      const el = document.querySelectorAll('span')[1];
      const { confidence } = generateSelectors(el);
      expect(confidence).toBe(0.2);
    });
  });
});
