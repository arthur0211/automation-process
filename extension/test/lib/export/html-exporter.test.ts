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
    const session = createSession({
      name: 'Test <script>alert("xss")</script>',
      stoppedAt: 1700000060000,
    });
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

  // ─── Multi-tab ──────────────────────────────────────────────────────────

  it('renders tab title when action has tabTitle', () => {
    const action = createAction({ tabTitle: 'Settings Page' });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('Tab: Settings Page');
  });

  it('omits tab info when action has no tabTitle', () => {
    const action = createAction();
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).not.toContain('Tab:');
  });

  it('escapes HTML entities in tabTitle', () => {
    const action = createAction({ tabTitle: '<script>xss</script>' });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).not.toContain('<script>xss</script>');
    expect(html).toContain('&lt;script&gt;xss&lt;/script&gt;');
  });

  // ─── Branding ────────────────────────────────────────────────────────────

  it('applies custom accent color from branding settings', () => {
    const action = createAction();
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action], undefined, {
      accentColor: '#e11d48',
      headerText: '',
      footerText: '',
    });
    // Accent color should be used for step-number background, play-btn color, TOC links, etc.
    expect(html).toContain('background: #e11d48');
    expect(html).toContain('color: #e11d48');
    // Should NOT contain the default blue for step-number
    expect(html).not.toContain('background: #3b82f6');
  });

  it('includes header text when branding provides headerText', () => {
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [], undefined, {
      accentColor: '#2563eb',
      headerText: 'Acme Corp - Internal Docs',
      footerText: '',
    });
    expect(html).toContain('branding-header');
    expect(html).toContain('Acme Corp - Internal Docs');
  });

  it('includes footer text when branding provides footerText', () => {
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [], undefined, {
      accentColor: '#2563eb',
      headerText: '',
      footerText: 'Confidential - Do not distribute',
    });
    expect(html).toContain('branding-footer');
    expect(html).toContain('Confidential - Do not distribute');
  });

  it('escapes HTML in branding header and footer text', () => {
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [], undefined, {
      accentColor: '#2563eb',
      headerText: '<script>alert("xss")</script>',
      footerText: '<img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('does not include header/footer elements when branding texts are empty', () => {
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [], undefined, {
      accentColor: '#2563eb',
      headerText: '',
      footerText: '',
    });
    // CSS class definitions exist, but no actual header/footer divs should be rendered
    expect(html).not.toContain('<div class="branding-header">');
    expect(html).not.toContain('<div class="branding-footer">');
  });

  // ─── Table of Contents ────────────────────────────────────────────────────

  it('generates table of contents for 10+ steps', () => {
    const actions = Array.from({ length: 12 }, (_, i) =>
      createAction({
        id: `action-${i + 1}`,
        sequenceNumber: i + 1,
        description: `Step ${i + 1} description`,
      }),
    );
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), actions);
    expect(html).toContain('Table of Contents');
    expect(html).toContain('<nav class="toc">');
    // Check that TOC links point to step anchors
    expect(html).toContain('href="#step-1"');
    expect(html).toContain('href="#step-12"');
    expect(html).toContain('Step 1: Step 1 description');
    expect(html).toContain('Step 12: Step 12 description');
    // Check that steps have id anchors
    expect(html).toContain('id="step-1"');
    expect(html).toContain('id="step-12"');
  });

  it('does not generate table of contents for fewer than 10 steps', () => {
    const actions = Array.from({ length: 9 }, (_, i) =>
      createAction({
        id: `action-${i + 1}`,
        sequenceNumber: i + 1,
        description: `Step ${i + 1} description`,
      }),
    );
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), actions);
    expect(html).not.toContain('Table of Contents');
    expect(html).not.toContain('<nav class="toc">');
  });

  it('generates TOC for exactly 10 steps', () => {
    const actions = Array.from({ length: 10 }, (_, i) =>
      createAction({
        id: `action-${i + 1}`,
        sequenceNumber: i + 1,
        description: `Step ${i + 1} description`,
      }),
    );
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), actions);
    expect(html).toContain('Table of Contents');
    expect(html).toContain('href="#step-10"');
  });

  it('adds id anchors to all steps regardless of TOC', () => {
    const action = createAction({ sequenceNumber: 1 });
    const html = exportToHtml(createSession({ stoppedAt: 1700000060000 }), [action]);
    expect(html).toContain('id="step-1"');
  });
});
