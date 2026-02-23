import type { CapturedAction, RecordingSession } from '../types';

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|~>])/g, '\\$1');
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function exportToMarkdown(
  session: RecordingSession,
  actions: CapturedAction[],
  includeScreenshots = false,
): string {
  const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const duration = (session.stoppedAt || Date.now()) - session.startedAt;

  const lines: string[] = [];

  // Title
  lines.push(`# ${escapeMarkdown(session.name)}`);
  lines.push('');

  // Metadata
  lines.push(`**Date:** ${new Date(session.startedAt).toISOString()}`);
  lines.push(`**Steps:** ${sorted.length}`);
  lines.push(`**Duration:** ${formatTime(duration)}`);
  lines.push(`**Start URL:** ${session.url}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Steps
  for (let i = 0; i < sorted.length; i++) {
    const action = sorted[i];
    const stepNum = i + 1;
    const description = action.llmDescription || action.description;

    lines.push(`## Step ${stepNum}: ${escapeMarkdown(description)}`);
    lines.push('');
    lines.push(`- **Action:** ${action.actionType}`);
    lines.push(`- **URL:** ${action.url}`);
    lines.push(`- **Selector:** \`${action.element.selectors.css}\``);

    if (action.tabTitle) {
      lines.push(`- **Tab:** ${escapeMarkdown(action.tabTitle)}`);
    }

    if (action.decisionPoint.isDecisionPoint) {
      lines.push('');
      lines.push(`> **Decision Point:** ${escapeMarkdown(action.decisionPoint.reason)}`);
      for (const branch of action.decisionPoint.branches) {
        lines.push(`> - *${escapeMarkdown(branch.condition)}:* ${escapeMarkdown(branch.description)}`);
      }
    }

    if (action.note) {
      lines.push('');
      lines.push(`> **Note:** ${escapeMarkdown(action.note)}`);
    }

    if (includeScreenshots && action.screenshotDataUrl) {
      lines.push('');
      lines.push(`![Step ${stepNum}](${action.screenshotDataUrl})`);
    }

    lines.push('');
  }

  // Validation summary
  if (session.validationResult) {
    const v = session.validationResult;
    lines.push('---');
    lines.push('');
    lines.push('## Validation Report');
    lines.push('');
    lines.push(`**Score:** ${v.overallScore}/10`);
    lines.push('');
    lines.push(escapeMarkdown(v.summary));

    if (v.issues.length > 0) {
      lines.push('');
      lines.push('### Issues');
      lines.push('');
      for (const issue of v.issues) {
        lines.push(`- **Step ${issue.step}:** ${escapeMarkdown(issue.description)}`);
      }
    }

    if (v.missingSteps.length > 0) {
      lines.push('');
      lines.push('### Missing Steps');
      lines.push('');
      for (const ms of v.missingSteps) {
        lines.push(`- **After step ${ms.afterStep}:** ${escapeMarkdown(ms.description)}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
