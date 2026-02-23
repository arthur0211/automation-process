import type { CapturedAction } from '../types';

function truncate(text: string, maxLen = 60): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function describeElement(action: CapturedAction): string {
  const el = action.element;

  // Use aria-label if available
  if (el.ariaLabel) return `'${truncate(el.ariaLabel)}'`;

  // Use visible text
  if (el.text) return `'${truncate(el.text)}'`;

  // Use placeholder for inputs
  if (el.placeholder) return `the '${truncate(el.placeholder)}' field`;

  // Use name attribute
  if (el.name) return `the '${el.name}' field`;

  // Use id
  if (el.id) return `#${el.id}`;

  // Use type + tag
  if (el.type && el.type !== 'text') return `a ${el.type} ${el.tag}`;

  return `a ${el.tag} element`;
}

function getPageName(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : ` (${u.pathname})`;
    return `${u.hostname}${path}`;
  } catch {
    return url;
  }
}

export function generateDescription(action: CapturedAction): string {
  const target = describeElement(action);
  const page = getPageName(action.url);

  switch (action.actionType) {
    case 'click': {
      const tag = action.element.tag;
      if (tag === 'a') return `Clicked link ${target} on ${page}`;
      if (tag === 'button' || action.element.role === 'button')
        return `Clicked button ${target} on ${page}`;
      if (tag === 'input' && action.element.type === 'checkbox')
        return `Toggled checkbox ${target} on ${page}`;
      if (tag === 'input' && action.element.type === 'radio')
        return `Selected radio ${target} on ${page}`;
      if (tag === 'select') return `Opened dropdown ${target} on ${page}`;
      return `Clicked ${target} on ${page}`;
    }

    case 'input': {
      const value = action.inputValue || '';
      const masked = action.element.type === 'password' ? '••••••••' : `'${truncate(value)}'`;
      return `Typed ${masked} in ${target} on ${page}`;
    }

    case 'scroll':
      return `Scrolled on ${page}`;

    case 'navigate':
      return `Navigated to ${page}`;

    case 'submit':
      return `Submitted form on ${page}`;

    case 'hover':
      return `Hovered over ${target} on ${page}`;

    case 'contextmenu':
      return `Right-clicked ${target} on ${page}`;

    default:
      return `Performed action on ${page}`;
  }
}
