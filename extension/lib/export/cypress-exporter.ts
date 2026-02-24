import type { CapturedAction, ElementMetadata, RecordingSession } from '../types';

function escapeSingleQuotes(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getLocator(element: ElementMetadata): string {
  if (element.selectors.testId) {
    return `cy.get('[data-testid="${escapeSingleQuotes(element.selectors.testId)}"]')`;
  }

  if (element.text && element.text.length > 0 && element.text.length <= 50) {
    return `cy.contains('${escapeSingleQuotes(element.text)}')`;
  }

  if (element.ariaLabel) {
    return `cy.get('[aria-label="${escapeSingleQuotes(element.ariaLabel)}"]')`;
  }

  return `cy.get('${escapeSingleQuotes(element.selectors.css)}')`;
}

function actionToCode(action: CapturedAction, index: number, nextAction?: CapturedAction): string {
  const lines: string[] = [];
  const description = action.llmDescription || action.description;
  const confidence = action.element.selectors.confidence;
  const indent = '    ';

  lines.push(`${indent}// Step ${index + 1}: ${description}`);

  if (confidence !== undefined) {
    lines.push(`${indent}// Selector confidence: ${confidence}`);
  }

  if (action.visualGrounding?.boundingBox && confidence !== undefined && confidence < 0.5) {
    const bbox = action.visualGrounding.boundingBox;
    const cx = Math.round((bbox.x0 + bbox.x1) / 2);
    const cy = Math.round((bbox.y0 + bbox.y1) / 2);
    lines.push(`${indent}// Visual grounding fallback (coords 0-1000): center=(${cx}, ${cy})`);
  }

  if (action.decisionPoint.isDecisionPoint) {
    lines.push(`${indent}// Decision Point: ${action.decisionPoint.reason}`);
  }

  const locator = getLocator(action.element);

  switch (action.actionType) {
    case 'click':
    case 'submit':
      lines.push(`${indent}${locator}.should('be.visible').click();`);
      if (nextAction && nextAction.url !== action.url) {
        try {
          const pathname = new URL(nextAction.url).pathname;
          lines.push(`${indent}cy.url().should('include', '${escapeSingleQuotes(pathname)}');`);
        } catch {
          // Non-fatal: skip URL assertion if URL is invalid
        }
      }
      break;
    case 'input': {
      const isPassword = action.element.type === 'password';
      const value = isPassword
        ? `Cypress.env('PASSWORD')`
        : `'${escapeSingleQuotes(action.inputValue ?? '')}'`;
      lines.push(`${indent}${locator}.clear().type(${value});`);
      break;
    }
    case 'scroll':
      lines.push(
        `${indent}cy.scrollTo(${action.scrollPosition?.x ?? 0}, ${action.scrollPosition?.y ?? 0});`,
      );
      break;
    case 'navigate':
      lines.push(`${indent}cy.visit('${escapeSingleQuotes(action.url)}');`);
      break;
    case 'hover':
      lines.push(`${indent}${locator}.trigger('mouseover');`);
      break;
    case 'contextmenu':
      lines.push(`${indent}${locator}.rightclick();`);
      if (nextAction && nextAction.url !== action.url) {
        try {
          const pathname = new URL(nextAction.url).pathname;
          lines.push(`${indent}cy.url().should('include', '${escapeSingleQuotes(pathname)}');`);
        } catch {
          // Non-fatal: skip URL assertion if URL is invalid
        }
      }
      break;
    default:
      lines.push(`${indent}// Unsupported action type: ${action.actionType}`);
      break;
  }

  return lines.join('\n');
}

export function exportToCypress(session: RecordingSession, actions: CapturedAction[]): string {
  const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const stepsCode = sorted.map((action, i) => actionToCode(action, i, sorted[i + 1])).join('\n\n');

  return `describe('${escapeSingleQuotes(session.name)}', () => {
  it('recorded flow', () => {
    cy.visit('${escapeSingleQuotes(session.url)}');

${stepsCode}
  });
});
`;
}
