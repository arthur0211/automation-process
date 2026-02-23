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

const APP_NAME = 'action_processor';
const USER_ID = 'extension-user';
const TIMEOUT_MS = 30_000;
const POLL_DELAYS = [500, 1000, 2000, 4000, 8000];
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = [429, 503];

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

function parseScreenshotParts(screenshotDataUrl: string): { text?: string; inlineData?: { mimeType: string; data: string } }[] {
  if (!screenshotDataUrl) return [];
  const match = screenshotDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (match) {
    return [{ inlineData: { mimeType: match[1], data: match[2] } }];
  }
  return [];
}

function buildHeaders(base: Record<string, string>, apiKey?: string): Record<string, string> {
  if (apiKey) {
    return { ...base, 'X-API-Key': apiKey };
  }
  return base;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || !RETRYABLE_STATUSES.includes(response.status) || attempt === maxRetries) {
        return response;
      }
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : POLL_DELAYS[Math.min(attempt, POLL_DELAYS.length - 1)];
      await new Promise(r => setTimeout(r, delay));
    } catch (err) {
      lastError = err as Error;
      if (attempt === maxRetries) break;
      await new Promise(r => setTimeout(r, POLL_DELAYS[Math.min(attempt, POLL_DELAYS.length - 1)]));
    }
  }
  throw lastError || new Error('fetchWithRetry exhausted');
}

async function pollSessionState(
  baseUrl: string,
  appName: string,
  sessionId: string,
  outputKeys: string[],
  apiKey?: string,
): Promise<Record<string, unknown>> {
  const headers = buildHeaders({}, apiKey);
  const fetchOpts: RequestInit = Object.keys(headers).length > 0
    ? { signal: AbortSignal.timeout(10_000), headers }
    : { signal: AbortSignal.timeout(10_000) };

  for (const delay of POLL_DELAYS) {
    await new Promise(r => setTimeout(r, delay));
    try {
      const res = await fetch(
        `${baseUrl}/apps/${appName}/users/${USER_ID}/sessions/${sessionId}`,
        fetchOpts,
      );
      if (!res.ok) continue;
      const data = await res.json();
      const state = data.state || {};
      if (outputKeys.every(k => state[k] !== undefined)) {
        return state;
      }
    } catch {
      continue;
    }
  }
  // Final attempt: return whatever state we have
  try {
    const res = await fetch(
      `${baseUrl}/apps/${appName}/users/${USER_ID}/sessions/${sessionId}`,
      fetchOpts,
    );
    if (res.ok) {
      const data = await res.json();
      return data.state || {};
    }
  } catch { /* return empty */ }
  return {};
}

export async function processActionWithBackend(
  action: CapturedAction,
  screenshotDataUrl: string,
  backendUrl: string,
  apiKey?: string,
): Promise<EnrichedAction | null> {
  if (!backendUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Build message parts: text metadata + screenshot as inlineData (ROAD-11)
    const textPart = {
      text: JSON.stringify({
        actionType: action.actionType,
        url: action.url,
        pageTitle: action.pageTitle,
        element: action.element,
        description: action.description,
        inputValue: action.inputValue,
      }),
    };
    const screenshotParts = parseScreenshotParts(screenshotDataUrl);

    // 1. Send action to ADK backend via POST /run with retry (ROAD-14)
    const runResponse = await fetchWithRetry(`${backendUrl}/run`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }, apiKey),
      signal: controller.signal,
      body: JSON.stringify({
        appName: APP_NAME,
        userId: USER_ID,
        sessionId: action.sessionId,
        newMessage: {
          role: 'user',
          parts: [textPart, ...screenshotParts],
        },
      }),
    });

    clearTimeout(timeout);

    if (!runResponse.ok) {
      console.warn(`ADK /run returned ${runResponse.status}`);
      return null;
    }

    // 2. Poll session state with exponential backoff (ROAD-12)
    const state = await pollSessionState(
      backendUrl,
      APP_NAME,
      action.sessionId,
      ['description', 'visual_analysis', 'decision_analysis'],
      apiKey,
    );

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
  apiKey?: string,
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

    const runResponse = await fetchWithRetry(`${backendUrl}/run`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }, apiKey),
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

    // Poll session state with backoff (ROAD-12)
    const state = await pollSessionState(
      backendUrl,
      VALIDATOR_APP_NAME,
      session.id,
      ['validation_result'],
      apiKey,
    );
    const raw = parseJsonSafe(state.validation_result);

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
  apiKey?: string,
): Promise<ComplexAnalysis | null> {
  if (!backendUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

    // Build parts with inlineData for screenshot (ROAD-11)
    const textPart = {
      text: JSON.stringify({
        actionType: action.actionType,
        url: action.url,
        pageTitle: action.pageTitle,
        element: action.element,
        description: action.llmDescription || action.description,
        originalAnalysis,
      }),
    };
    const screenshotParts = parseScreenshotParts(screenshotDataUrl);

    const runResponse = await fetchWithRetry(`${backendUrl}/run`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }, apiKey),
      signal: controller.signal,
      body: JSON.stringify({
        appName: ANALYZER_APP_NAME,
        userId: USER_ID,
        sessionId: action.sessionId,
        newMessage: {
          role: 'user',
          parts: [textPart, ...screenshotParts],
        },
      }),
    });

    clearTimeout(timeout);
    if (!runResponse.ok) {
      console.warn(`ADK analyzer /run returned ${runResponse.status}`);
      return null;
    }

    // Poll session state with backoff (ROAD-12)
    const state = await pollSessionState(
      backendUrl,
      ANALYZER_APP_NAME,
      action.sessionId,
      ['complex_analysis'],
      apiKey,
    );
    const raw = parseJsonSafe(state.complex_analysis);

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
