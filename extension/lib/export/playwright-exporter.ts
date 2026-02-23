import type { CapturedAction, ElementMetadata, RecordingSession } from '../types';

function escapeSingleQuotes(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getLocator(element: ElementMetadata): string {
  if (element.selectors.testId) {
    return `page.getByTestId('${escapeSingleQuotes(element.selectors.testId)}')`;
  }

  if (element.role && element.text && element.text.length > 0 && element.text.length <= 50) {
    return `page.getByRole('${escapeSingleQuotes(element.role)}', { name: '${escapeSingleQuotes(element.text)}' })`;
  }

  if (element.ariaLabel) {
    if (element.role) {
      return `page.getByRole('${escapeSingleQuotes(element.role)}', { name: '${escapeSingleQuotes(element.ariaLabel)}' })`;
    }
    return `page.getByLabel('${escapeSingleQuotes(element.ariaLabel)}')`;
  }

  if (element.placeholder && (element.tag === 'input' || element.tag === 'textarea')) {
    return `page.getByPlaceholder('${escapeSingleQuotes(element.placeholder)}')`;
  }

  if (element.text && element.text.length > 0 && element.text.length <= 30) {
    return `page.getByText('${escapeSingleQuotes(element.text)}')`;
  }

  return `page.locator('${escapeSingleQuotes(element.selectors.css)}')`;
}

function actionToCode(action: CapturedAction, index: number): string {
  const lines: string[] = [];
  const description = action.llmDescription || action.description;
  const confidence = action.element.selectors.confidence;

  lines.push(`  // Step ${index + 1}: ${description}`);

  if (confidence !== undefined) {
    lines.push(`  // Selector confidence: ${confidence}`);
  }

  if (action.decisionPoint.isDecisionPoint) {
    lines.push(`  // Decision Point: ${action.decisionPoint.reason}`);
  }

  const locator = getLocator(action.element);

  switch (action.actionType) {
    case 'click':
    case 'submit':
      lines.push(`  await expect(${locator}).toBeVisible();`);
      lines.push(`  await ${locator}.click();`);
      break;
    case 'input':
      lines.push(`  await ${locator}.fill('${escapeSingleQuotes(action.inputValue ?? '')}');`);
      break;
    case 'scroll':
      lines.push(
        `  await page.evaluate(() => window.scrollTo(${action.scrollPosition?.x ?? 0}, ${action.scrollPosition?.y ?? 0}));`,
      );
      break;
    case 'navigate':
      lines.push(`  await page.goto('${escapeSingleQuotes(action.url)}');`);
      lines.push(`  await page.waitForLoadState('networkidle');`);
      break;
    default:
      lines.push(`  // Unsupported action type: ${action.actionType}`);
      break;
  }

  return lines.join('\n');
}

export function exportToPlaywright(session: RecordingSession, actions: CapturedAction[]): string {
  const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const stepsCode = sorted.map((action, i) => actionToCode(action, i)).join('\n\n');

  return `import { test, expect } from '@playwright/test';

test.describe('${escapeSingleQuotes(session.name)}', () => {
  test('recorded flow', async ({ page }) => {
    await page.goto('${escapeSingleQuotes(session.url)}');
    await page.waitForLoadState('networkidle');

${stepsCode}
  });
});
`;
}
