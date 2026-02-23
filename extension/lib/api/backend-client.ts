import type { CapturedAction, RecordingSession, ValidationResult, VisualAnalysis } from '../types';

export interface EnrichedAction {
  humanDescription: string;
  visualAnalysis: VisualAnalysis;
  decisionAnalysis: {
    isDecisionPoint: boolean;
    reason: string;
    branches: { condition: string; description: string }[];
  };
}

const APP_NAME = 'recording_pipeline';
const USER_ID = 'extension-user';
const TIMEOUT_MS = 30_000;

function parseJsonSafe<T = Record<string, unknown>>(value: unknown): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {} as T;
    }
  }
  if (typeof value === 'object' && value !== null) {
    return value as T;
  }
  return {} as T;
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
    const description =
      typeof state.description === 'string' ? state.description : action.description;

    const visualAnalysis = parseJsonSafe<VisualAnalysis>(state.visual_analysis);

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

// ─── doc_validator ──────────────────────────────────────────────────────────

const VALIDATOR_APP_NAME = 'doc_validator';
const VALIDATION_TIMEOUT_MS = 60_000;

export async function validateRecordingWithBackend(
  session: RecordingSession,
  actions: CapturedAction[],
  backendUrl: string,
): Promise<ValidationResult | null> {
  if (!backendUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

    const sorted = [...actions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const recordingPayload = {
      sessionName: session.name,
      startUrl: session.url,
      totalSteps: sorted.length,
      duration: (session.stoppedAt || Date.now()) - session.startedAt,
      steps: sorted.map((a, i) => ({
        stepNumber: i + 1,
        actionType: a.actionType,
        url: a.url,
        pageTitle: a.pageTitle,
        description: a.llmDescription || a.description,
        element: { tag: a.element.tag, text: a.element.text, role: a.element.role },
        hasScreenshot: Boolean(a.screenshotDataUrl),
        decisionPoint: a.decisionPoint,
      })),
    };

    const runResponse = await fetch(`${backendUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        appName: VALIDATOR_APP_NAME,
        userId: USER_ID,
        sessionId: session.id,
        newMessage: {
          role: 'user',
          parts: [{ text: JSON.stringify(recordingPayload) }],
        },
      }),
    });

    clearTimeout(timeout);
    if (!runResponse.ok) {
      console.warn(`ADK validator /run returned ${runResponse.status}`);
      return null;
    }

    const stateResponse = await fetch(
      `${backendUrl}/apps/${VALIDATOR_APP_NAME}/users/${USER_ID}/sessions/${session.id}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!stateResponse.ok) return null;

    const sessionData = await stateResponse.json();
    const raw = parseJsonSafe(sessionData.state?.validation_result);

    return {
      overallScore: typeof raw.overallScore === 'number' ? raw.overallScore : 0,
      issues: Array.isArray(raw.issues) ? raw.issues : [],
      suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
      missingSteps: Array.isArray(raw.missingSteps) ? raw.missingSteps : [],
      summary: typeof raw.summary === 'string' ? raw.summary : '',
    };
  } catch (err) {
    console.warn('validateRecordingWithBackend failed:', err);
    return null;
  }
}

// ─── complex_analyzer ───────────────────────────────────────────────────────

const ANALYZER_APP_NAME = 'complex_analyzer';
const ANALYSIS_TIMEOUT_MS = 45_000;

export interface ComplexAnalysis {
  elements: { type: string; text: string; position: string }[];
  interactedElement: { type: string; text: string; description: string };
  pageContext: { app: string; section: string; workflow: string };
  statusIndicators: string[];
  layout: string;
  confidence: number;
  reasoning: string;
}

export async function analyzeComplexAction(
  action: CapturedAction,
  originalAnalysis: VisualAnalysis,
  screenshotDataUrl: string,
  backendUrl: string,
): Promise<ComplexAnalysis | null> {
  if (!backendUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

    const runResponse = await fetch(`${backendUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        appName: ANALYZER_APP_NAME,
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
                description: action.llmDescription || action.description,
                originalAnalysis,
                screenshotDataUrl,
              }),
            },
          ],
        },
      }),
    });

    clearTimeout(timeout);
    if (!runResponse.ok) {
      console.warn(`ADK analyzer /run returned ${runResponse.status}`);
      return null;
    }

    const stateResponse = await fetch(
      `${backendUrl}/apps/${ANALYZER_APP_NAME}/users/${USER_ID}/sessions/${action.sessionId}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!stateResponse.ok) return null;

    const sessionData = await stateResponse.json();
    const raw = parseJsonSafe(sessionData.state?.complex_analysis);

    if (typeof raw.confidence !== 'number') return null;

    return {
      elements: Array.isArray(raw.elements) ? raw.elements : [],
      interactedElement: (raw.interactedElement as ComplexAnalysis['interactedElement']) || {
        type: '',
        text: '',
        description: '',
      },
      pageContext: (raw.pageContext as ComplexAnalysis['pageContext']) || {
        app: '',
        section: '',
        workflow: '',
      },
      statusIndicators: Array.isArray(raw.statusIndicators) ? raw.statusIndicators : [],
      layout: typeof raw.layout === 'string' ? raw.layout : '',
      confidence: raw.confidence,
      reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : '',
    };
  } catch (err) {
    console.warn('analyzeComplexAction failed:', err);
    return null;
  }
}
