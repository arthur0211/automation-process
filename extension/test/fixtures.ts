import type {
  CapturedAction,
  RecordingSession,
  ElementMetadata,
  ElementSelector,
  BoundingBox,
  DecisionPoint,
} from '../lib/types';

export function createSelector(overrides: Partial<ElementSelector> = {}): ElementSelector {
  return {
    css: 'button.submit-btn',
    xpath: '/html/body/div/button',
    ...overrides,
  };
}

export function createBoundingBox(overrides: Partial<BoundingBox> = {}): BoundingBox {
  return {
    x: 100,
    y: 200,
    width: 150,
    height: 40,
    ...overrides,
  };
}

export function createElementMetadata(overrides: Partial<ElementMetadata> = {}): ElementMetadata {
  return {
    tag: 'button',
    id: '',
    classes: ['submit-btn'],
    text: 'Submit',
    role: 'button',
    ariaLabel: '',
    name: '',
    type: '',
    href: '',
    placeholder: '',
    boundingBox: createBoundingBox(),
    selectors: createSelector(),
    ...overrides,
  };
}

export function createDecisionPoint(overrides: Partial<DecisionPoint> = {}): DecisionPoint {
  return {
    isDecisionPoint: false,
    reason: '',
    branches: [],
    ...overrides,
  };
}

export function createAction(overrides: Partial<CapturedAction> = {}): CapturedAction {
  return {
    id: 'action-1',
    sessionId: 'session-1',
    timestamp: 1700000000000,
    sequenceNumber: 1,
    actionType: 'click',
    url: 'https://example.com/page',
    pageTitle: 'Example Page',
    element: createElementMetadata(),
    description: 'Clicked button Submit on example.com',
    note: '',
    decisionPoint: createDecisionPoint(),
    ...overrides,
  };
}

export function createSession(overrides: Partial<RecordingSession> = {}): RecordingSession {
  return {
    id: 'session-1',
    name: 'Test Session',
    startedAt: 1700000000000,
    status: 'recording',
    url: 'https://example.com',
    actionCount: 0,
    ...overrides,
  };
}
