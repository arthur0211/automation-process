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

/** Generate a camelCase key name for a testData entry from element metadata. */
function generateTestDataKey(action: CapturedAction, index: number): string {
  const label =
    action.element.placeholder ||
    action.element.ariaLabel ||
    action.element.name ||
    action.element.selectors.testId ||
    '';

  if (label) {
    // Convert to camelCase: "Enter email" -> "enterEmail", "first-name" -> "firstName"
    return label
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .split(/[\s_-]+/)
      .map((word, i) =>
        i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      )
      .join('');
  }

  return `input${index + 1}`;
}

interface ActionCodeContext {
  action: CapturedAction;
  index: number;
  nextAction?: CapturedAction;
  testDataKey?: string;
}

function actionToCode(ctx: ActionCodeContext): string {
  const { action, index, nextAction, testDataKey } = ctx;
  const lines: string[] = [];
  const description = action.llmDescription || action.description;
  const confidence = action.element.selectors.confidence;
  const indent = '      ';

  lines.push(
    `    await test.step('Step ${index + 1}: ${escapeSingleQuotes(description)}', async () => {`,
  );

  if (confidence !== undefined) {
    lines.push(`${indent}// Selector confidence: ${confidence}`);
  }

  if (action.decisionPoint.isDecisionPoint) {
    lines.push(`${indent}// Decision Point: ${action.decisionPoint.reason}`);
  }

  const locator = getLocator(action.element);

  switch (action.actionType) {
    case 'click':
    case 'submit':
      lines.push(`${indent}await expect(${locator}).toBeVisible();`);
      lines.push(`${indent}await ${locator}.click();`);
      if (nextAction && nextAction.url !== action.url) {
        lines.push(
          `${indent}await page.waitForURL('${escapeSingleQuotes(nextAction.url)}');`,
        );
      }
      break;
    case 'input':
      if (testDataKey) {
        lines.push(`${indent}await ${locator}.fill(testData.${testDataKey});`);
      } else {
        lines.push(
          `${indent}await ${locator}.fill('${escapeSingleQuotes(action.inputValue ?? '')}');`,
        );
      }
      break;
    case 'scroll':
      lines.push(
        `${indent}await page.evaluate(() => window.scrollTo(${action.scrollPosition?.x ?? 0}, ${action.scrollPosition?.y ?? 0}));`,
      );
      break;
    case 'navigate':
      lines.push(`${indent}await page.goto('${escapeSingleQuotes(action.url)}');`);
      lines.push(`${indent}await page.waitForLoadState('networkidle');`);
      break;
    case 'hover':
      lines.push(`${indent}await expect(${locator}).toBeVisible();`);
      lines.push(`${indent}await ${locator}.hover();`);
      break;
    case 'contextmenu':
      lines.push(`${indent}await expect(${locator}).toBeVisible();`);
      lines.push(`${indent}await ${locator}.click({ button: 'right' });`);
      if (nextAction && nextAction.url !== action.url) {
        lines.push(
          `${indent}await page.waitForURL('${escapeSingleQuotes(nextAction.url)}');`,
        );
      }
      break;
    default:
      lines.push(`${indent}// Unsupported action type: ${action.actionType}`);
      break;
  }

  lines.push('    });');

  return lines.join('\n');
}

/** Build the testData object from input actions. Returns entries and the generated code block. */
function buildTestData(
  sorted: CapturedAction[],
): { entries: Map<number, string>; code: string } {
  const entries = new Map<number, string>();
  const dataLines: string[] = [];

  sorted.forEach((action, i) => {
    if (action.actionType !== 'input') return;

    const key = generateTestDataKey(action, i);
    entries.set(i, key);

    const isPassword = action.element.type === 'password';
    const value = isPassword
      ? `process.env.PASSWORD ?? ''`
      : `'${escapeSingleQuotes(action.inputValue ?? '')}'`;

    dataLines.push(`      ${key}: ${value},`);
  });

  if (dataLines.length === 0) {
    return { entries, code: '' };
  }

  const code = `    const testData = {\n${dataLines.join('\n')}\n    };\n\n`;
  return { entries, code };
}

export function exportToPlaywright(session: RecordingSession, actions: CapturedAction[]): string {
  const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const { entries: testDataEntries, code: testDataCode } = buildTestData(sorted);

  const stepsCode = sorted
    .map((action, i) =>
      actionToCode({
        action,
        index: i,
        nextAction: sorted[i + 1],
        testDataKey: testDataEntries.get(i),
      }),
    )
    .join('\n\n');

  return `import { test, expect } from '@playwright/test';

test.describe('${escapeSingleQuotes(session.name)}', () => {
  test('recorded flow', async ({ page }) => {
    await page.goto('${escapeSingleQuotes(session.url)}');
    await page.waitForLoadState('networkidle');

${testDataCode}${stepsCode}
  });
});
`;
}
