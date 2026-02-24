import type { CapturedAction, ElementMetadata, RecordingSession } from '../types';

function escapeSingleQuotes(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getSelector(element: ElementMetadata): string {
  if (element.selectors.testId) {
    return `[data-testid="${escapeSingleQuotes(element.selectors.testId)}"]`;
  }

  if (element.id) {
    return `#${escapeSingleQuotes(element.id)}`;
  }

  if (element.ariaLabel) {
    return `[aria-label="${escapeSingleQuotes(element.ariaLabel)}"]`;
  }

  return escapeSingleQuotes(element.selectors.css);
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
  const selector = getSelector(action.element);

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

  switch (action.actionType) {
    case 'click':
    case 'submit': {
      lines.push(`${indent}const el${index + 1} = await page.waitForSelector('${selector}');`);
      if (nextAction && nextAction.url !== action.url) {
        lines.push(`${indent}await Promise.all([`);
        lines.push(`${indent}  page.waitForNavigation({ waitUntil: 'networkidle0' }),`);
        lines.push(`${indent}  el${index + 1}.click(),`);
        lines.push(`${indent}]);`);
      } else {
        lines.push(`${indent}await el${index + 1}.click();`);
      }
      break;
    }
    case 'input': {
      const isPassword = action.element.type === 'password';
      const value = isPassword
        ? `process.env.PASSWORD || ''`
        : `'${escapeSingleQuotes(action.inputValue ?? '')}'`;
      lines.push(`${indent}const el${index + 1} = await page.waitForSelector('${selector}');`);
      lines.push(`${indent}await el${index + 1}.click({ clickCount: 3 });`);
      lines.push(`${indent}await el${index + 1}.type(${value});`);
      break;
    }
    case 'scroll':
      lines.push(
        `${indent}await page.evaluate(() => window.scrollTo(${action.scrollPosition?.x ?? 0}, ${action.scrollPosition?.y ?? 0}));`,
      );
      break;
    case 'navigate':
      lines.push(`${indent}await page.goto('${escapeSingleQuotes(action.url)}', { waitUntil: 'networkidle0' });`);
      break;
    case 'hover': {
      lines.push(`${indent}const el${index + 1} = await page.waitForSelector('${selector}');`);
      lines.push(`${indent}await el${index + 1}.hover();`);
      break;
    }
    case 'contextmenu': {
      lines.push(`${indent}const el${index + 1} = await page.waitForSelector('${selector}');`);
      lines.push(`${indent}await el${index + 1}.click({ button: 'right' });`);
      break;
    }
    default:
      lines.push(`${indent}// Unsupported action type: ${action.actionType}`);
      break;
  }

  return lines.join('\n');
}

export function exportToPuppeteer(
  session: RecordingSession,
  actions: CapturedAction[],
): string {
  const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const stepsCode = sorted
    .map((action, i) => actionToCode(action, i, sorted[i + 1]))
    .join('\n\n');

  return `const puppeteer = require('puppeteer');

describe('${escapeSingleQuotes(session.name)}', function () {
  let browser, page;

  before(async function () {
    browser = await puppeteer.launch({ headless: false });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  after(async function () {
    await browser.close();
  });

  it('recorded flow', async function () {
    this.timeout(60000);
    await page.goto('${escapeSingleQuotes(session.url)}', { waitUntil: 'networkidle0' });

${stepsCode}
  });
});
`;
}
