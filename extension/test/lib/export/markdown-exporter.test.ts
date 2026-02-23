import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToMarkdown } from '@/lib/export/markdown-exporter';
import {
  createAction,
  createSession,
  createDecisionPoint,
  createValidationResult,
} from '../../fixtures';

describe('exportToMarkdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports markdown with session header', () => {
    const session = createSession({ name: 'My Process', stoppedAt: 1700000060000 });
    const md = exportToMarkdown(session, []);

    expect(md).toContain('# My Process');
    expect(md).toContain('**Steps:** 0');
    expect(md).toContain('**Start URL:** https://example.com');
    expect(md).toContain('**Date:**');
  });

  it('includes step descriptions', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ sequenceNumber: 1, description: 'Clicked the submit button' }),
    ];
    const md = exportToMarkdown(session, actions);

    expect(md).toContain('## Step 1:');
    expect(md).toContain('Clicked the submit button');
    expect(md).toContain('- **Action:** click');
    expect(md).toContain('- **URL:** https://example.com/page');
    expect(md).toContain('- **Selector:** `button.submit-btn`');
  });

  it('uses llmDescription over description when available', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({
        description: 'template desc',
        llmDescription: 'Enhanced by LLM',
      }),
    ];
    const md = exportToMarkdown(session, actions);

    expect(md).toContain('Enhanced by LLM');
    expect(md).not.toContain('template desc');
  });

  it('falls back to description when llmDescription is absent', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [createAction({ description: 'template desc' })];
    const md = exportToMarkdown(session, actions);

    expect(md).toContain('template desc');
  });

  it('sorts actions by sequenceNumber', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ id: 'a3', sequenceNumber: 3, description: 'Third' }),
      createAction({ id: 'a1', sequenceNumber: 1, description: 'First' }),
      createAction({ id: 'a2', sequenceNumber: 2, description: 'Second' }),
    ];
    const md = exportToMarkdown(session, actions);

    const firstPos = md.indexOf('First');
    const secondPos = md.indexOf('Second');
    const thirdPos = md.indexOf('Third');
    expect(firstPos).toBeLessThan(secondPos);
    expect(secondPos).toBeLessThan(thirdPos);
  });

  it('includes decision point callouts', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({
        decisionPoint: createDecisionPoint({
          isDecisionPoint: true,
          reason: 'Multiple paths available',
          branches: [
            { condition: 'If admin', description: 'Go to admin panel' },
            { condition: 'If user', description: 'Go to dashboard' },
          ],
        }),
      }),
    ];
    const md = exportToMarkdown(session, actions);

    expect(md).toContain('> **Decision Point:** Multiple paths available');
    expect(md).toContain('> - *If admin:* Go to admin panel');
    expect(md).toContain('> - *If user:* Go to dashboard');
  });

  it('does not include decision callout for non-decision points', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({
        decisionPoint: createDecisionPoint({ isDecisionPoint: false }),
      }),
    ];
    const md = exportToMarkdown(session, actions);

    expect(md).not.toContain('Decision Point');
  });

  it('includes screenshots when enabled', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ screenshotDataUrl: 'data:image/png;base64,abc123' }),
    ];
    const md = exportToMarkdown(session, actions, true);

    expect(md).toContain('![Step 1](data:image/png;base64,abc123)');
  });

  it('excludes screenshots by default', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ screenshotDataUrl: 'data:image/png;base64,abc123' }),
    ];
    const md = exportToMarkdown(session, actions);

    expect(md).not.toContain('![');
    expect(md).not.toContain('data:image/png');
  });

  it('excludes screenshots when disabled explicitly', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ screenshotDataUrl: 'data:image/png;base64,abc123' }),
    ];
    const md = exportToMarkdown(session, actions, false);

    expect(md).not.toContain('![');
  });

  it('handles empty actions', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const md = exportToMarkdown(session, []);

    expect(md).toContain('# Test Session');
    expect(md).toContain('**Steps:** 0');
    expect(md).not.toContain('## Step');
  });

  it('includes tab info when present', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [createAction({ tabTitle: 'Settings Page' })];
    const md = exportToMarkdown(session, actions);

    expect(md).toContain('- **Tab:** Settings Page');
  });

  it('omits tab info when not present', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [createAction()];
    const md = exportToMarkdown(session, actions);

    expect(md).not.toContain('**Tab:**');
  });

  it('includes validation summary when present', () => {
    const session = createSession({
      stoppedAt: 1700000060000,
      validationResult: createValidationResult({
        overallScore: 8,
        summary: 'Good quality documentation.',
        issues: [{ step: 2, type: 'unclear', description: 'Step is ambiguous' }],
        missingSteps: [{ afterStep: 3, description: 'Missing confirmation step' }],
      }),
    });
    const md = exportToMarkdown(session, []);

    expect(md).toContain('## Validation Report');
    expect(md).toContain('**Score:** 8/10');
    expect(md).toContain('Good quality documentation\\.');
    expect(md).toContain('### Issues');
    expect(md).toContain('**Step 2:** Step is ambiguous');
    expect(md).toContain('### Missing Steps');
    expect(md).toContain('**After step 3:** Missing confirmation step');
  });

  it('omits validation section when no validationResult', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const md = exportToMarkdown(session, []);

    expect(md).not.toContain('Validation Report');
    expect(md).not.toContain('Score:');
  });

  it('escapes markdown special characters in descriptions', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ description: 'Clicked **bold** and _italic_ text [link](url)' }),
    ];
    const md = exportToMarkdown(session, actions);

    expect(md).toContain('Clicked \\*\\*bold\\*\\*');
    expect(md).toContain('\\_italic\\_');
    expect(md).toContain('\\[link\\]\\(url\\)');
  });

  it('includes notes when present', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [createAction({ note: 'Important: verify this step' })];
    const md = exportToMarkdown(session, actions);

    expect(md).toContain('> **Note:** Important: verify this step');
  });

  it('omits note section when note is empty', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [createAction({ note: '' })];
    const md = exportToMarkdown(session, actions);

    expect(md).not.toContain('**Note:**');
  });

  it('formats duration correctly', () => {
    const session = createSession({
      startedAt: 1700000000000,
      stoppedAt: 1700000125000,
    });
    const md = exportToMarkdown(session, []);

    expect(md).toContain('**Duration:** 2m 5s');
  });

  it('calculates step count from actions', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ id: 'a1', sequenceNumber: 1 }),
      createAction({ id: 'a2', sequenceNumber: 2 }),
      createAction({ id: 'a3', sequenceNumber: 3 }),
    ];
    const md = exportToMarkdown(session, actions);

    expect(md).toContain('**Steps:** 3');
  });
});
