import type { CapturedAction, ElementMetadata, RecordingSession } from '../types';

function escapeSingleQuotes(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getLocator(element: ElementMetadata): string {
  if (element.selectors.testId) {
    return `By.css('[data-testid="${escapeSingleQuotes(element.selectors.testId)}"]')`;
  }

  if (element.id) {
    return `By.id('${escapeSingleQuotes(element.id)}')`;
  }

  if (element.tag === 'a' && element.text && element.text.length > 0 && element.text.length <= 50) {
    return `By.linkText('${escapeSingleQuotes(element.text)}')`;
  }

  if (element.name) {
    return `By.name('${escapeSingleQuotes(element.name)}')`;
  }

  return `By.css('${escapeSingleQuotes(element.selectors.css)}')`;
}

function actionToCode(
  action: CapturedAction,
  index: number,
  nextAction?: CapturedAction,
): string {
  const lines: string[] = [];
  const description = action.llmDescription || action.description;
  const confidence = action.element.selectors.confidence;
  const indent = '      ';

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
    case 'submit': {
      lines.push(`${indent}const el${index + 1} = await driver.wait(until.elementLocated(${locator}), 5000);`);
      lines.push(`${indent}await el${index + 1}.click();`);
      if (nextAction && nextAction.url !== action.url) {
        try {
          const pathname = new URL(nextAction.url).pathname;
          lines.push(`${indent}await driver.wait(until.urlContains('${escapeSingleQuotes(pathname)}'), 5000);`);
        } catch {
          // Non-fatal: skip URL wait if URL is invalid
        }
      }
      break;
    }
    case 'input': {
      const isPassword = action.element.type === 'password';
      const value = isPassword
        ? `process.env.PASSWORD || ''`
        : `'${escapeSingleQuotes(action.inputValue ?? '')}'`;
      lines.push(`${indent}const el${index + 1} = await driver.wait(until.elementLocated(${locator}), 5000);`);
      lines.push(`${indent}await el${index + 1}.clear();`);
      lines.push(`${indent}await el${index + 1}.sendKeys(${value});`);
      break;
    }
    case 'scroll':
      lines.push(
        `${indent}await driver.executeScript('window.scrollTo(${action.scrollPosition?.x ?? 0}, ${action.scrollPosition?.y ?? 0})');`,
      );
      break;
    case 'navigate':
      lines.push(`${indent}await driver.get('${escapeSingleQuotes(action.url)}');`);
      break;
    case 'hover': {
      lines.push(`${indent}const el${index + 1} = await driver.wait(until.elementLocated(${locator}), 5000);`);
      lines.push(`${indent}await driver.actions().move({ origin: el${index + 1} }).perform();`);
      break;
    }
    case 'contextmenu': {
      lines.push(`${indent}const el${index + 1} = await driver.wait(until.elementLocated(${locator}), 5000);`);
      lines.push(`${indent}await driver.actions().contextClick(el${index + 1}).perform();`);
      if (nextAction && nextAction.url !== action.url) {
        try {
          const pathname = new URL(nextAction.url).pathname;
          lines.push(`${indent}await driver.wait(until.urlContains('${escapeSingleQuotes(pathname)}'), 5000);`);
        } catch {
          // Non-fatal
        }
      }
      break;
    }
    default:
      lines.push(`${indent}// Unsupported action type: ${action.actionType}`);
      break;
  }

  return lines.join('\n');
}

export function exportToSelenium(
  session: RecordingSession,
  actions: CapturedAction[],
): string {
  const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const stepsCode = sorted
    .map((action, i) => actionToCode(action, i, sorted[i + 1]))
    .join('\n\n');

  return `const { Builder, By, until } = require('selenium-webdriver');

describe('${escapeSingleQuotes(session.name)}', function () {
  let driver;

  before(async function () {
    driver = await new Builder().forBrowser('chrome').build();
  });

  after(async function () {
    await driver.quit();
  });

  it('recorded flow', async function () {
    this.timeout(60000);
    await driver.get('${escapeSingleQuotes(session.url)}');

${stepsCode}
  });
});
`;
}
