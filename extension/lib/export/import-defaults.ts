import type { ElementMetadata, DecisionPoint } from '../types';

export function createElementMetadata(): ElementMetadata {
  return {
    tag: 'unknown',
    id: '',
    classes: [],
    text: '',
    role: '',
    ariaLabel: '',
    name: '',
    type: '',
    href: '',
    placeholder: '',
    boundingBox: { x: 0, y: 0, width: 0, height: 0 },
    selectors: { css: '', xpath: '' },
  };
}

export function createDecisionPoint(): DecisionPoint {
  return {
    isDecisionPoint: false,
    reason: '',
    branches: [],
  };
}
