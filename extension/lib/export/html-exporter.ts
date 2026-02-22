import type { CapturedAction, RecordingSession } from '../types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function exportToHtml(
  session: RecordingSession,
  actions: CapturedAction[],
): string {
  const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const duration = (session.stoppedAt || Date.now()) - session.startedAt;

  const stepsHtml = sorted
    .map(
      (action, index) => `
    <div class="step">
      <div class="step-header">
        <span class="step-number">${index + 1}</span>
        <span class="step-action">${escapeHtml(action.actionType)}</span>
        ${action.decisionPoint.isDecisionPoint ? '<span class="decision-badge">Decision Point</span>' : ''}
      </div>
      ${
        action.screenshotDataUrl
          ? `<div class="screenshot"><img src="${action.screenshotDataUrl}" alt="Step ${index + 1}" loading="lazy" /></div>`
          : ''
      }
      <div class="step-description">${escapeHtml(action.llmDescription || action.description)}</div>
      ${action.note ? `<div class="step-note"><strong>Note:</strong> ${escapeHtml(action.note)}</div>` : ''}
      <div class="step-meta">
        <span>URL: ${escapeHtml(action.url)}</span>
        <span>Element: <code>${escapeHtml(action.element.selectors.css)}</code></span>
      </div>
    </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; color: #333; line-height: 1.5; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.875rem; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb; }
    .step { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .step-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .step-number { background: #3b82f6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
    .step-action { font-size: 0.75rem; text-transform: uppercase; color: #9ca3af; font-weight: 500; }
    .decision-badge { font-size: 0.625rem; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 9999px; font-weight: 500; }
    .screenshot { margin-bottom: 0.75rem; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; }
    .screenshot img { width: 100%; height: auto; display: block; }
    .step-description { font-size: 0.9375rem; margin-bottom: 0.5rem; }
    .step-note { font-size: 0.8125rem; color: #4b5563; background: #f9fafb; padding: 0.5rem 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; }
    .step-meta { font-size: 0.75rem; color: #9ca3af; display: flex; flex-direction: column; gap: 0.125rem; }
    .step-meta code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 0.6875rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(session.name)}</h1>
  <div class="meta">
    ${sorted.length} steps &middot; ${formatTime(duration)} &middot; Started at ${escapeHtml(session.url)}
  </div>
  ${stepsHtml}
</body>
</html>`;
}
