import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generatePrintHtml } from '@/lib/export/pdf-exporter';
import {
  createAction,
  createSession,
  createDecisionPoint,
  createValidationResult,
} from '../../fixtures';

describe('generatePrintHtml', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns valid HTML with DOCTYPE', () => {
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), []);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  // ─── Print CSS ──────────────────────────────────────────────────────────────

  it('includes @media print rules', () => {
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), []);
    expect(html).toContain('@media print');
  });

  it('adds page-break-inside: avoid to steps in print CSS', () => {
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), []);
    expect(html).toContain('.step { page-break-inside: avoid; }');
  });

  it('adds page-break-after: always to cover page in print CSS', () => {
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), []);
    expect(html).toContain('.cover-page { page-break-after: always;');
  });

  // ─── Cover Page ─────────────────────────────────────────────────────────────

  it('includes cover page with session name', () => {
    const session = createSession({ name: 'Login Process', stoppedAt: 1700000060000 });
    const html = generatePrintHtml(session, []);
    expect(html).toContain('cover-page');
    expect(html).toContain('Login Process');
  });

  it('includes formatted date on cover page', () => {
    const session = createSession({ startedAt: 1700000000000, stoppedAt: 1700000060000 });
    const html = generatePrintHtml(session, []);
    // formatDate produces a localized string containing the year
    expect(html).toContain('2023');
  });

  it('includes step count on cover page', () => {
    const actions = [
      createAction({ id: 'a1', sequenceNumber: 1 }),
      createAction({ id: 'a2', sequenceNumber: 2 }),
      createAction({ id: 'a3', sequenceNumber: 3 }),
    ];
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), actions);
    expect(html).toContain('<span class="stat-value">3</span> Steps');
  });

  it('includes duration on cover page', () => {
    const session = createSession({ startedAt: 1700000000000, stoppedAt: 1700000125000 });
    const html = generatePrintHtml(session, []);
    expect(html).toContain('2m 5s');
    expect(html).toContain('Duration');
  });

  it('includes start URL on cover page', () => {
    const session = createSession({ url: 'https://app.example.com', stoppedAt: 1700000060000 });
    const html = generatePrintHtml(session, []);
    expect(html).toContain('https://app.example.com');
  });

  // ─── No Video / No Interactive Elements ─────────────────────────────────────

  it('does not include video elements', () => {
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), [createAction()]);
    expect(html).not.toContain('<video');
    expect(html).not.toContain('seekVideo');
    expect(html).not.toContain('play-btn');
  });

  it('does not include interactive script tags', () => {
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), [createAction()]);
    expect(html).not.toContain('<script');
  });

  // ─── Steps ──────────────────────────────────────────────────────────────────

  it('renders steps in sequenceNumber order', () => {
    const actions = [
      createAction({ id: 'a3', sequenceNumber: 3, description: 'Third' }),
      createAction({ id: 'a1', sequenceNumber: 1, description: 'First' }),
      createAction({ id: 'a2', sequenceNumber: 2, description: 'Second' }),
    ];
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), actions);
    const firstPos = html.indexOf('First');
    const secondPos = html.indexOf('Second');
    const thirdPos = html.indexOf('Third');
    expect(firstPos).toBeLessThan(secondPos);
    expect(secondPos).toBeLessThan(thirdPos);
  });

  it('escapes HTML entities in session name', () => {
    const session = createSession({
      name: 'Test <script>alert("xss")</script>',
      stoppedAt: 1700000060000,
    });
    const html = generatePrintHtml(session, []);
    expect(html).toContain('Test &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('includes screenshots as img tags when present', () => {
    const action = createAction({ screenshotDataUrl: 'data:image/png;base64,abc123' });
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('<img src="data:image/png;base64,abc123"');
  });

  it('shows decision badge for decision points', () => {
    const action = createAction({
      decisionPoint: createDecisionPoint({ isDecisionPoint: true, reason: 'Multiple paths' }),
    });
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('decision-badge');
    expect(html).toContain('Decision Point');
  });

  it('uses llmDescription over description when available', () => {
    const action = createAction({
      description: 'template desc',
      llmDescription: 'Enhanced by LLM',
    });
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('Enhanced by LLM');
    expect(html).not.toContain('template desc');
  });

  it('renders notes when present', () => {
    const action = createAction({ note: 'Important: verify this step' });
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('step-note');
    expect(html).toContain('Important: verify this step');
  });

  // ─── Validation Section ─────────────────────────────────────────────────────

  it('includes validation report when present on session', () => {
    const session = createSession({
      stoppedAt: 1700000060000,
      validationResult: createValidationResult({ overallScore: 9, summary: 'Excellent docs' }),
    });
    const html = generatePrintHtml(session, []);
    expect(html).toContain('VALIDATION REPORT');
    expect(html).toContain('Excellent docs');
  });

  it('omits validation section when not present', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const html = generatePrintHtml(session, []);
    expect(html).not.toContain('VALIDATION REPORT');
  });

  // ─── Print-optimized layout ─────────────────────────────────────────────────

  it('sets white background for print optimization', () => {
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), []);
    expect(html).toContain('background: #fff');
  });

  it('constrains screenshot image height for reasonable file size', () => {
    const html = generatePrintHtml(createSession({ stoppedAt: 1700000060000 }), []);
    expect(html).toContain('max-height: 400px');
    // Print media query further constrains
    expect(html).toContain('max-height: 300px');
  });

  it('includes PDF Export in the title', () => {
    const session = createSession({ name: 'My Process', stoppedAt: 1700000060000 });
    const html = generatePrintHtml(session, []);
    expect(html).toContain('<title>My Process - PDF Export</title>');
  });
});
