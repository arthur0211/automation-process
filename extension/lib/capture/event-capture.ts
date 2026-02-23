import type {
  ActionType,
  BoundingBox,
  ElementMetadata,
  CapturedAction,
  DecisionPoint,
  CaptureSettings,
} from '../types';
import { DEFAULT_CAPTURE_SETTINGS } from '../types';
import { generateSelectors } from './selector-generator';

// ─── Helpers ────────────────────────────────────────────────────────────────

let sequenceCounter = 0;
let currentSessionId = '';
let isCapturing = false;
let captureSettings: CaptureSettings = { ...DEFAULT_CAPTURE_SETTINGS };

function generateId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getVisibleText(element: Element): string {
  const text = (element as HTMLElement).innerText || element.textContent || '';
  return text.trim().slice(0, 200);
}

function getBoundingBox(element: Element): BoundingBox {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function buildElementMetadata(element: Element): ElementMetadata {
  const el = element as HTMLElement;
  const selectors = generateSelectors(element);

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || '',
    classes: Array.from(element.classList),
    text: getVisibleText(element),
    role: element.getAttribute('role') || '',
    ariaLabel: element.getAttribute('aria-label') || '',
    name: (el as HTMLInputElement).name || '',
    type: (el as HTMLInputElement).type || '',
    href: (el as HTMLAnchorElement).href || '',
    placeholder: (el as HTMLInputElement).placeholder || '',
    boundingBox: getBoundingBox(element),
    selectors,
  };
}

function emptyDecisionPoint(): DecisionPoint {
  return { isDecisionPoint: false, reason: '', branches: [] };
}

function buildAction(
  actionType: ActionType,
  element: Element,
  extra: Partial<CapturedAction> = {},
): CapturedAction {
  sequenceCounter++;
  const metadata = buildElementMetadata(element);

  return {
    id: generateId(),
    sessionId: currentSessionId,
    timestamp: Date.now(),
    sequenceNumber: sequenceCounter,
    actionType,
    url: window.location.href,
    pageTitle: document.title,
    element: metadata,
    description: '',
    note: '',
    decisionPoint: emptyDecisionPoint(),
    ...extra,
  };
}

function sendAction(action: CapturedAction) {
  chrome.runtime.sendMessage({
    type: 'ACTION_CAPTURED',
    payload: { action },
  });
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

function handleClick(event: MouseEvent) {
  if (!isCapturing) return;
  const target = event.target as Element;
  if (!target || target === document.documentElement || target === document.body) return;

  const action = buildAction('click', target, {
    clickCoordinates: {
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    },
  });
  sendAction(action);
}

// Debounce input events - capture final value, not every keystroke
const inputTimers = new Map<Element, ReturnType<typeof setTimeout>>();

function handleInput(event: Event) {
  if (!isCapturing) return;
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (!target) return;

  // Clear previous timer for this element
  const existing = inputTimers.get(target);
  if (existing) clearTimeout(existing);

  // Debounce: wait after last input
  inputTimers.set(
    target,
    setTimeout(() => {
      inputTimers.delete(target);
      const value = (target as HTMLInputElement).type === 'password' ? '••••••••' : target.value;
      const action = buildAction('input', target, {
        inputValue: value,
      });
      sendAction(action);
    }, captureSettings.inputDebounceMs),
  );
}

// Throttle scroll events - capture at most once per second
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let lastScrollTime = 0;

function handleScroll() {
  if (!isCapturing) return;
  const now = Date.now();
  if (now - lastScrollTime < captureSettings.scrollThrottleMs) {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(
      handleScroll,
      captureSettings.scrollThrottleMs - (now - lastScrollTime),
    );
    return;
  }
  lastScrollTime = now;

  sendAction(
    buildAction('scroll', document.documentElement, {
      scrollPosition: { x: window.scrollX, y: window.scrollY },
    }),
  );
}

function handleSubmit(event: Event) {
  if (!isCapturing) return;
  const target = (event.target as HTMLFormElement) || document.body;

  sendAction(buildAction('submit', target));
}

// Capture change events for select, date/time, color, range inputs
function handleChange(event: Event) {
  if (!isCapturing) return;
  const target = event.target as HTMLSelectElement | HTMLInputElement;
  if (!target) return;

  const tag = target.tagName.toLowerCase();
  const type = (target as HTMLInputElement).type || '';
  const isSelect = tag === 'select';
  const isSpecialInput = [
    'date',
    'time',
    'datetime-local',
    'month',
    'week',
    'color',
    'range',
  ].includes(type);

  if (!isSelect && !isSpecialInput) return;

  sendAction(buildAction('input', target, { inputValue: target.value }));
}

// Navigation detection via History API patching
let lastUrl = window.location.href;

function checkNavigation() {
  if (!isCapturing) return;
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    sendAction(buildAction('navigate', document.documentElement));
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

let navigationInterval: ReturnType<typeof setInterval> | null = null;

export function startCapturing(sessionId: string, settings?: Partial<CaptureSettings>) {
  currentSessionId = sessionId;
  sequenceCounter = 0;
  isCapturing = true;
  lastUrl = window.location.href;
  captureSettings = { ...DEFAULT_CAPTURE_SETTINGS, ...settings };

  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
  document.addEventListener('submit', handleSubmit, true);
  document.addEventListener('change', handleChange, true);

  // Poll for SPA navigation changes
  navigationInterval = setInterval(checkNavigation, 500);
}

export function stopCapturing() {
  isCapturing = false;

  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('scroll', handleScroll, true);
  document.removeEventListener('submit', handleSubmit, true);
  document.removeEventListener('change', handleChange, true);

  if (navigationInterval) {
    clearInterval(navigationInterval);
    navigationInterval = null;
  }

  // Clear pending input debounce timers
  for (const timer of inputTimers.values()) {
    clearTimeout(timer);
  }
  inputTimers.clear();

  if (scrollTimer) {
    clearTimeout(scrollTimer);
    scrollTimer = null;
  }
}

export function pauseCapturing() {
  isCapturing = false;
}

export function resumeCapturing() {
  isCapturing = true;
}
