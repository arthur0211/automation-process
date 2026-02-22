import type { ElementSelector } from '../types';

function getXPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === current.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    const tag = current.tagName.toLowerCase();
    parts.unshift(index > 1 ? `${tag}[${index}]` : tag);
    current = current.parentElement;
  }

  return '/' + parts.join('/');
}

function getCssSelector(element: Element): string {
  // 1. Try ID (most reliable)
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // 2. Try aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    const tag = element.tagName.toLowerCase();
    const selector = `${tag}[aria-label="${CSS.escape(ariaLabel)}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  // 3. Try unique class combination
  const classes = Array.from(element.classList).filter(
    (c) => !c.match(/^(js-|is-|has-|ng-|v-|_|css-|sc-|emotion-)/) && c.length < 40,
  );
  if (classes.length > 0) {
    const tag = element.tagName.toLowerCase();
    const selector = `${tag}.${classes.map((c) => CSS.escape(c)).join('.')}`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  // 4. Try name attribute (for form inputs)
  const name = element.getAttribute('name');
  if (name) {
    const tag = element.tagName.toLowerCase();
    const selector = `${tag}[name="${CSS.escape(name)}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  // 5. Fall back to nth-of-type path
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName,
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tag}:nth-of-type(${index})`);
      } else {
        parts.unshift(tag);
      }
    } else {
      parts.unshift(tag);
    }
    current = parent;
  }

  return parts.join(' > ');
}

export function generateSelectors(element: Element): ElementSelector {
  const role = element.getAttribute('role') || '';
  const testId =
    element.getAttribute('data-testid') ||
    element.getAttribute('data-test-id') ||
    '';

  return {
    css: getCssSelector(element),
    xpath: getXPath(element),
    ...(role && { role }),
    ...(testId && { testId }),
  };
}
