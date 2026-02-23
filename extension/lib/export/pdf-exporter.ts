import type { CapturedAction, RecordingSession } from '../types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generates a print-optimized HTML document suitable for Print to PDF.
 * No video, no interactive elements, includes cover page and page breaks.
 */
export function generatePrintHtml(
  session: RecordingSession,
  actions: CapturedAction[],
): string {
  const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const duration = (session.stoppedAt || Date.now()) - session.startedAt;

  const stepsHtml = sorted
    .map((action, index) => {
      return `
    <div class="step">
      <div class="step-header">
        <span class="step-number">${index + 1}</span>
        <span class="step-action">${escapeHtml(action.actionType)}</span>
        ${action.decisionPoint.isDecisionPoint ? '<span class="decision-badge">Decision Point</span>' : ''}
      </div>
      ${
        action.screenshotDataUrl
          ? `<div class="screenshot"><img src="${action.screenshotDataUrl}" alt="Step ${index + 1}" /></div>`
          : ''
      }
      <div class="step-description">${escapeHtml(action.llmDescription || action.description)}</div>
      ${action.note ? `<div class="step-note"><strong>Note:</strong> ${escapeHtml(action.note)}</div>` : ''}
      <div class="step-meta">
        <span>URL: ${escapeHtml(action.url)}</span>
        <span>Element: <code>${escapeHtml(action.element.selectors.css)}</code></span>
        ${action.tabTitle ? `<span>Tab: ${escapeHtml(action.tabTitle)}</span>` : ''}
      </div>
    </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(session.name)} - PDF Export</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #333; line-height: 1.5; padding: 2rem; max-width: 900px; margin: 0 auto; }
    .cover-page { text-align: center; padding: 4rem 2rem; min-height: 60vh; display: flex; flex-direction: column; justify-content: center; align-items: center; }
    .cover-page h1 { font-size: 2rem; margin-bottom: 1rem; color: #1f2937; }
    .cover-page .cover-meta { font-size: 1rem; color: #6b7280; margin-bottom: 0.5rem; }
    .cover-page .cover-stats { font-size: 0.875rem; color: #9ca3af; margin-top: 1.5rem; display: flex; gap: 2rem; justify-content: center; }
    .cover-page .cover-stats span { display: flex; flex-direction: column; align-items: center; }
    .cover-page .cover-stats .stat-value { font-size: 1.5rem; font-weight: 700; color: #3b82f6; }
    h2.steps-heading { font-size: 1.25rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e5e7eb; }
    .step { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
    .step-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .step-number { background: #3b82f6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
    .step-action { font-size: 0.75rem; text-transform: uppercase; color: #9ca3af; font-weight: 500; }
    .decision-badge { font-size: 0.625rem; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 9999px; font-weight: 500; }
    .screenshot { margin-bottom: 0.75rem; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; }
    .screenshot img { width: 100%; height: auto; display: block; max-height: 400px; object-fit: contain; }
    .step-description { font-size: 0.9375rem; margin-bottom: 0.5rem; }
    .step-note { font-size: 0.8125rem; color: #4b5563; background: #f9fafb; padding: 0.5rem 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; }
    .step-meta { font-size: 0.75rem; color: #9ca3af; display: flex; flex-direction: column; gap: 0.125rem; }
    .step-meta code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 0.6875rem; }
    .validation-section { border-left: 3px solid; border-radius: 8px; padding: 1.25rem; margin-top: 2rem; background: #fff; border-color: #e5e7eb; }
    .validation-section.score-high { border-color: #22c55e; }
    .validation-section.score-mid { border-color: #eab308; }
    .validation-section.score-low { border-color: #ef4444; }

    @media print {
      body { padding: 0; }
      .cover-page { page-break-after: always; min-height: 100vh; }
      .step { page-break-inside: avoid; }
      .screenshot img { max-height: 300px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="cover-page">
    <h1>${escapeHtml(session.name)}</h1>
    <div class="cover-meta">${formatDate(session.startedAt)}</div>
    <div class="cover-meta">Started at ${escapeHtml(session.url)}</div>
    <div class="cover-stats">
      <span><span class="stat-value">${sorted.length}</span> Steps</span>
      <span><span class="stat-value">${formatTime(duration)}</span> Duration</span>
    </div>
  </div>
  <h2 class="steps-heading">Steps</h2>
  ${stepsHtml}
  ${
    session.validationResult
      ? `
  <div class="step validation-section ${session.validationResult.overallScore >= 7 ? 'score-high' : session.validationResult.overallScore >= 4 ? 'score-mid' : 'score-low'}">
    <div class="step-header">
      <span class="step-number" style="background: ${session.validationResult.overallScore >= 7 ? '#22c55e' : session.validationResult.overallScore >= 4 ? '#eab308' : '#ef4444'}">${session.validationResult.overallScore}</span>
      <span class="step-action">VALIDATION REPORT</span>
    </div>
    <div class="step-description">${escapeHtml(session.validationResult.summary)}</div>
    ${session.validationResult.issues.length > 0 ? `<div class="step-note"><strong>Issues:</strong><ul style="margin:0.25rem 0 0 1rem">${session.validationResult.issues.map((i) => `<li>Step ${i.step}: ${escapeHtml(i.description)}</li>`).join('')}</ul></div>` : ''}
    ${session.validationResult.missingSteps.length > 0 ? `<div class="step-note"><strong>Missing Steps:</strong><ul style="margin:0.25rem 0 0 1rem">${session.validationResult.missingSteps.map((ms) => `<li>After step ${ms.afterStep}: ${escapeHtml(ms.description)}</li>`).join('')}</ul></div>` : ''}
  </div>`
      : ''
  }
</body>
</html>`;
}

/**
 * Opens a print-optimized HTML in a hidden iframe and triggers the browser's
 * Print dialog (which allows saving as PDF). Cleans up after printing.
 */
export function exportToPdf(session: RecordingSession, actions: CapturedAction[]): void {
  const html = generatePrintHtml(session, actions);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for images to load before printing
  const images = iframeDoc.querySelectorAll('img');
  const imagePromises = Array.from(images).map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete) {
          resolve();
        } else {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }
      }),
  );

  Promise.all(imagePromises).then(() => {
    iframe.contentWindow?.print();
    // Clean up after a short delay to allow print dialog to open
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  });
}
