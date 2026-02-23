import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToHtml } from '@/lib/export/html-exporter';
import { createAction, createSession, createDecisionPoint } from '../../fixtures';

describe('exportToHtml', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns valid HTML with DOCTYPE', () => {
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), []);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('escapes HTML entities in session name', () => {
    const session = createSession({ name: 'Test <script>alert("xss")</script>', stoppedAt: 1700000060000 });
    const html = exportToHtml(session, []);
    expect(html).toContain('Test &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('escapes HTML entities in action descriptions', () => {
    const action = createAction({ description: 'Clicked <b>bold</b> & "quoted"' });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('Clicked &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;');
  });

  it('renders steps in sequenceNumber order', () => {
    const actions = [
      createAction({ id: 'a3', sequenceNumber: 3, description: 'Third' }),
      createAction({ id: 'a1', sequenceNumber: 1, description: 'First' }),
      createAction({ id: 'a2', sequenceNumber: 2, description: 'Second' }),
    ];
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), actions);
    const firstPos = html.indexOf('First');
    const secondPos = html.indexOf('Second');
    const thirdPos = html.indexOf('Third');
    expect(firstPos).toBeLessThan(secondPos);
    expect(secondPos).toBeLessThan(thirdPos);
  });

  it('shows decision badge for decision points', () => {
    const action = createAction({
      decisionPoint: createDecisionPoint({ isDecisionPoint: true, reason: 'Multiple paths' }),
    });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('decision-badge');
    expect(html).toContain('Decision Point');
  });

  it('does not show decision badge for non-decision points', () => {
    const action = createAction({
      decisionPoint: createDecisionPoint({ isDecisionPoint: false }),
    });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    // The CSS defines .decision-badge styling, but the step itself should not have the badge
    expect(html).not.toContain('Decision Point</span>');
  });

  it('includes screenshot as img tag when present', () => {
    const action = createAction({ screenshotDataUrl: 'data:image/png;base64,abc123' });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('<img src="data:image/png;base64,abc123"');
    expect(html).toContain('loading="lazy"');
  });

  it('omits screenshot section when not present', () => {
    const action = createAction({ screenshotDataUrl: undefined });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).not.toContain('<img');
  });

  it('renders notes when present', () => {
    const action = createAction({ note: 'Important: verify this step' });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('step-note');
    expect(html).toContain('Important: verify this step');
  });

  it('omits note section when note is empty', () => {
    const action = createAction({ note: '' });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    // CSS defines .step-note class, but no note div should be rendered in the step
    expect(html).not.toContain('<strong>Note:</strong>');
  });

  // ─── formatTime ─────────────────────────────────────────────────────────────

  it('formats duration in seconds', () => {
    const session = createSession({ startedAt: 1700000000000, stoppedAt: 1700000045000 });
    const html = exportToHtml(session, []);
    expect(html).toContain('45s');
  });

  it('formats duration in minutes and seconds', () => {
    const session = createSession({ startedAt: 1700000000000, stoppedAt: 1700000125000 });
    const html = exportToHtml(session, []);
    expect(html).toContain('2m 5s');
  });

  it('formats duration in hours and minutes', () => {
    const session = createSession({ startedAt: 1700000000000, stoppedAt: 1700007500000 });
    const html = exportToHtml(session, []);
    // 7500 seconds = 2h 5m
    expect(html).toContain('2h 5m');
  });

  it('uses llmDescription over description when available', () => {
    const action = createAction({
      description: 'template desc',
      llmDescription: 'Enhanced by LLM',
    });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('Enhanced by LLM');
    expect(html).not.toContain('template desc');
  });

  // ─── Video ────────────────────────────────────────────────────────────────

  it('embeds video player when videoDataUrl is provided', () => {
    const html = exportToHtml(
      createSession({ stoppedAt: 1700000060000 }),
      [],
      'data:video/webm;base64,AABBCC',
    );
    expect(html).toContain('<video id="recording-video"');
    expect(html).toContain('data:video/webm;base64,AABBCC');
    expect(html).toContain('video/webm');
    expect(html).toContain('seekVideo');
  });

  it('does not include video section when no videoDataUrl', () => {
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), []);
    expect(html).not.toContain('<video');
    expect(html).not.toContain('seekVideo');
  });

  it('renders play-from-here button with timestamp offset when video present', () => {
    const session = createSession({ startedAt: 1700000000000, stoppedAt: 1700000060000 });
    const action = createAction({ timestamp: 1700000005000 });
    const html = exportToHtml(session, [action], 'data:video/webm;base64,X');
    expect(html).toContain('play-btn');
    expect(html).toContain('seekVideo(5)');
  });

  it('sanitizes non-data-video URLs to prevent XSS', () => {
    const html = exportToHtml(
      createSession({ stoppedAt: 1700000060000 }),
      [],
      'javascript:alert(1)',
    );
    expect(html).not.toContain('<video');
    expect(html).not.toContain('javascript:');
  });

  it('clamps negative timestamp offset to zero', () => {
    const session = createSession({ startedAt: 1700000010000, stoppedAt: 1700000060000 });
    const action = createAction({ timestamp: 1700000005000 }); // before session start
    const html = exportToHtml(session, [action], 'data:video/webm;base64,X');
    expect(html).toContain('seekVideo(0)');
  });

  it('does not render play button when no video', () => {
    const session = createSession({ startedAt: 1700000000000, stoppedAt: 1700000060000 });
    const action = createAction({ timestamp: 1700000005000 });
    const html = exportToHtml(session, [action]);
    expect(html).not.toContain('seekVideo(');
    expect(html).not.toContain('Play from here');
  });
});
