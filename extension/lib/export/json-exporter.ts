import type { CapturedAction, RecordingSession, ProcessExport, ProcessStep } from '../types';

function actionToStep(action: CapturedAction, index: number): ProcessStep {
  return {
    stepNumber: index + 1,
    actionType: action.actionType,
    url: action.url,
    pageTitle: action.pageTitle,
    element: action.element,
    description: action.llmDescription || action.description,
    note: action.note,
    screenshotDataUrl: action.screenshotDataUrl,
    decisionPoint: action.decisionPoint,
    timestamp: action.timestamp,
    ...(action.tabId !== undefined && { tabId: action.tabId }),
    ...(action.tabTitle && { tabTitle: action.tabTitle }),
  };
}

export function exportToJson(
  session: RecordingSession,
  actions: CapturedAction[],
): string {
  const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const output: ProcessExport = {
    version: '1.0.0',
    metadata: {
      name: session.name,
      createdAt: new Date(session.startedAt).toISOString(),
      totalSteps: sorted.length,
      startUrl: session.url,
      duration: (session.stoppedAt || Date.now()) - session.startedAt,
      ...(session.validationResult && { validation: session.validationResult }),
    },
    steps: sorted.map(actionToStep),
  };

  return JSON.stringify(output, null, 2);
}
