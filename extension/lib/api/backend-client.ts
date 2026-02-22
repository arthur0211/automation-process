import type { CapturedAction } from '../types';

export interface EnrichedAction {
  humanDescription: string;
  visualAnalysis: Record<string, unknown>;
  decisionAnalysis: {
    isDecisionPoint: boolean;
    reason: string;
    branches: { condition: string; description: string }[];
  };
}

const APP_NAME = 'recording_pipeline';
const USER_ID = 'extension-user';
const TIMEOUT_MS = 30_000;

function parseJsonSafe(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function processActionWithBackend(
  action: CapturedAction,
  screenshotDataUrl: string,
  backendUrl: string,
): Promise<EnrichedAction | null> {
  if (!backendUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // 1. Send action to ADK backend via POST /run
    const runResponse = await fetch(`${backendUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        appName: APP_NAME,
        userId: USER_ID,
        sessionId: action.sessionId,
        newMessage: {
          role: 'user',
          parts: [
            {
              text: JSON.stringify({
                actionType: action.actionType,
                url: action.url,
                pageTitle: action.pageTitle,
                element: action.element,
                description: action.description,
                inputValue: action.inputValue,
                screenshotDataUrl,
              }),
            },
          ],
        },
      }),
    });

    clearTimeout(timeout);

    if (!runResponse.ok) {
      console.warn(`ADK /run returned ${runResponse.status}`);
      return null;
    }

    // 2. Read session state to get output_key values
    const sessionResponse = await fetch(
      `${backendUrl}/apps/${APP_NAME}/users/${USER_ID}/sessions/${action.sessionId}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!sessionResponse.ok) {
      console.warn(`ADK session GET returned ${sessionResponse.status}`);
      return null;
    }

    const sessionData = await sessionResponse.json();
    const state = sessionData.state || {};

    // 3. Extract enrichment from session state (output_keys from agents)
    const description = typeof state.description === 'string'
      ? state.description
      : action.description;

    const visualAnalysis = parseJsonSafe(state.visual_analysis);

    const decisionRaw = parseJsonSafe(state.decision_analysis);
    const decisionAnalysis = {
      isDecisionPoint: Boolean(decisionRaw.isDecisionPoint),
      reason: typeof decisionRaw.reason === 'string' ? decisionRaw.reason : '',
      branches: Array.isArray(decisionRaw.branches) ? decisionRaw.branches : [],
    };

    return { humanDescription: description, visualAnalysis, decisionAnalysis };
  } catch (err) {
    console.warn('processActionWithBackend failed:', err);
    return null;
  }
}
