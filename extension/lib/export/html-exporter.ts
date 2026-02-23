import type { CapturedAction, RecordingSession, BrandingSettings } from '../types';

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

export function exportToHtml(
  session: RecordingSession,
  actions: CapturedAction[],
  videoDataUrl?: string,
  branding?: BrandingSettings,
): string {
  // Sanitize: only allow data:video/ URLs to prevent XSS
  if (videoDataUrl && !videoDataUrl.startsWith('data:video/')) {
    videoDataUrl = undefined;
  }
  const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const duration = (session.stoppedAt || Date.now()) - session.startedAt;

  const accent = branding?.accentColor || '#3b82f6';

  const stepsHtml = sorted
    .map((action, index) => {
      const offsetMs = action.timestamp - session.startedAt;
      const offsetSec = Math.max(0, Math.floor(offsetMs / 1000));
      const playButton = videoDataUrl
        ? `<button class="play-btn" onclick="seekVideo(${offsetSec})" title="Play from here">&#9654; ${formatTime(offsetMs)}</button>`
        : '';
      return `
    <div class="step" id="step-${index + 1}">
      <div class="step-header">
        <span class="step-number">${index + 1}</span>
        <span class="step-action">${escapeHtml(action.actionType)}</span>
        ${action.decisionPoint.isDecisionPoint ? '<span class="decision-badge">Decision Point</span>' : ''}
        ${playButton}
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
        ${action.tabTitle ? `<span>Tab: ${escapeHtml(action.tabTitle)}</span>` : ''}
      </div>
    </div>`;
    })
    .join('\n');

  // Generate Table of Contents for 10+ steps
  const tocHtml =
    sorted.length >= 10
      ? `
  <nav class="toc">
    <h2>Table of Contents</h2>
    <ol>
      ${sorted.map((action, index) => `<li><a href="#step-${index + 1}">Step ${index + 1}: ${escapeHtml(action.llmDescription || action.description)}</a></li>`).join('\n      ')}
    </ol>
  </nav>`
      : '';

  const headerHtml =
    branding?.headerText
      ? `\n  <div class="branding-header">${escapeHtml(branding.headerText)}</div>`
      : '';

  const footerHtml =
    branding?.footerText
      ? `\n  <div class="branding-footer">${escapeHtml(branding.footerText)}</div>`
      : '';

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
    .branding-header { font-size: 0.875rem; color: #4b5563; margin-bottom: 1rem; padding: 0.75rem; background: #f9fafb; border-left: 3px solid ${accent}; border-radius: 4px; }
    .branding-footer { font-size: 0.8125rem; color: #6b7280; margin-top: 2rem; padding: 0.75rem; border-top: 1px solid #e5e7eb; text-align: center; }
    .toc { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .toc h2 { font-size: 1rem; margin-bottom: 0.75rem; color: ${accent}; }
    .toc ol { padding-left: 1.5rem; }
    .toc li { font-size: 0.8125rem; margin-bottom: 0.25rem; }
    .toc a { color: ${accent}; text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .step { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .step-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .step-number { background: ${accent}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
    .step-action { font-size: 0.75rem; text-transform: uppercase; color: #9ca3af; font-weight: 500; }
    .decision-badge { font-size: 0.625rem; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 9999px; font-weight: 500; }
    .screenshot { margin-bottom: 0.75rem; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; }
    .screenshot img { width: 100%; height: auto; display: block; }
    .step-description { font-size: 0.9375rem; margin-bottom: 0.5rem; }
    .step-note { font-size: 0.8125rem; color: #4b5563; background: #f9fafb; padding: 0.5rem 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; }
    .step-meta { font-size: 0.75rem; color: #9ca3af; display: flex; flex-direction: column; gap: 0.125rem; }
    .step-meta code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 0.6875rem; }
    .play-btn { font-size: 0.625rem; background: #eff6ff; color: ${accent}; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 4px; cursor: pointer; margin-left: auto; }
    .play-btn:hover { background: #dbeafe; }
    .video-section { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .video-section video { width: 100%; border-radius: 6px; border: 1px solid #e5e7eb; max-height: 500px; }
    .video-section h2 { font-size: 1rem; margin-bottom: 0.75rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(session.name)}</h1>${headerHtml}
  <div class="meta">
    ${sorted.length} steps &middot; ${formatTime(duration)} &middot; Started at ${escapeHtml(session.url)}
  </div>
  ${
    videoDataUrl
      ? `
  <div class="video-section">
    <h2>Recording</h2>
    <video id="recording-video" controls>
      <source src="${videoDataUrl}" type="${videoDataUrl.match(/^data:([^;]+);/)?.[1] ?? 'video/webm'}" />
    </video>
  </div>
  <script>
    function seekVideo(seconds) {
      var v = document.getElementById('recording-video');
      if (v) { v.currentTime = seconds; v.play(); v.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  </script>`
      : ''
  }
  ${tocHtml}
  ${stepsHtml}
  ${
    session.validationResult
      ? `
  <div class="step" style="border-left: 3px solid ${session.validationResult.overallScore >= 7 ? '#22c55e' : session.validationResult.overallScore >= 4 ? '#eab308' : '#ef4444'}; margin-top: 2rem;">
    <div class="step-header">
      <span class="step-number" style="background: ${session.validationResult.overallScore >= 7 ? '#22c55e' : session.validationResult.overallScore >= 4 ? '#eab308' : '#ef4444'}">${session.validationResult.overallScore}</span>
      <span class="step-action">VALIDATION REPORT</span>
    </div>
    <div class="step-description">${escapeHtml(session.validationResult.summary)}</div>
    ${session.validationResult.issues.length > 0 ? `<div class="step-note"><strong>Issues:</strong><ul style="margin:0.25rem 0 0 1rem">${session.validationResult.issues.map((i) => `<li>Step ${i.step}: ${escapeHtml(i.description)}</li>`).join('')}</ul></div>` : ''}
    ${session.validationResult.missingSteps.length > 0 ? `<div class="step-note"><strong>Missing Steps:</strong><ul style="margin:0.25rem 0 0 1rem">${session.validationResult.missingSteps.map((ms) => `<li>After step ${ms.afterStep}: ${escapeHtml(ms.description)}</li>`).join('')}</ul></div>` : ''}
  </div>`
      : ''
  }${footerHtml}
</body>
</html>`;
}
