import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  processActionWithBackend,
  validateRecordingWithBackend,
  analyzeComplexAction,
} from '@/lib/api/backend-client';
import { createAction, createSession } from '../../fixtures';

const BACKEND_URL = 'http://localhost:8000';

function mockSessionState(state: Record<string, unknown>) {
  return {
    id: 'session-1',
    appName: 'action_processor',
    userId: 'extension-user',
    state,
  };
}

// Helper: mock fetch to return /run OK, then session state on any GET
function setupFetchMock(
  fetchMock: ReturnType<typeof vi.fn>,
  state: Record<string, unknown>,
  opts?: { runStatus?: number; sessionStatus?: number },
) {
  const runStatus = opts?.runStatus ?? 200;
  const sessionStatus = opts?.sessionStatus ?? 200;

  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      return Promise.resolve({
        ok: runStatus === 200,
        status: runStatus,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });
    }
    // GET session state (polling)
    return Promise.resolve({
      ok: sessionStatus === 200,
      status: sessionStatus,
      json: () => Promise.resolve(mockSessionState(state)),
    });
  });
}

describe('processActionWithBackend', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns null when backendUrl is empty', async () => {
    const result = await processActionWithBackend(createAction(), '', '');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends screenshot as inlineData image parts (ROAD-11)', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks the Submit button',
      visual_analysis: { elements: [], layout: 'form' },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    const promise = processActionWithBackend(
      createAction({ sessionId: 'sess-123' }),
      'data:image/png;base64,abc123',
      BACKEND_URL,
    );

    const result = await promise;

    // Verify /run request has inlineData part
    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    expect(postCalls.length).toBe(1);
    const body = JSON.parse(postCalls[0][1].body as string);
    expect(body.appName).toBe('action_processor');
    expect(body.newMessage.parts).toHaveLength(2);
    expect(body.newMessage.parts[0]).toHaveProperty('text');
    expect(body.newMessage.parts[1]).toEqual({
      inlineData: { mimeType: 'image/png', data: 'abc123' },
    });

    // Verify text part does NOT include screenshotDataUrl
    const textPart = JSON.parse(body.newMessage.parts[0].text);
    expect(textPart).not.toHaveProperty('screenshotDataUrl');

    expect(result).toEqual({
      humanDescription: 'Clicks the Submit button',
      visualAnalysis: { elements: [], layout: 'form' },
      decisionAnalysis: { isDecisionPoint: false, reason: '', branches: [] },
    });
  });

  it('sends only text part when screenshot is empty', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks button',
      visual_analysis: {},
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    await processActionWithBackend(createAction(), '', BACKEND_URL);

    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    const body = JSON.parse(postCalls[0][1].body as string);
    expect(body.newMessage.parts).toHaveLength(1);
    expect(body.newMessage.parts[0]).toHaveProperty('text');
  });

  it('sends only text part when screenshot is not a valid data URL', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks button',
      visual_analysis: {},
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    await processActionWithBackend(createAction(), 'not-a-data-url', BACKEND_URL);

    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    const body = JSON.parse(postCalls[0][1].body as string);
    expect(body.newMessage.parts).toHaveLength(1);
  });

  it('polls session state until output keys are present (ROAD-12)', async () => {
    let pollCount = 0;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve([]),
        });
      }
      pollCount++;
      // First poll: incomplete state
      if (pollCount <= 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSessionState({ description: 'partial' })),
        });
      }
      // Second poll: complete state
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            mockSessionState({
              description: 'Complete description',
              visual_analysis: { elements: [] },
              decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
            }),
          ),
      });
    });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);

    expect(result).not.toBeNull();
    expect(result!.humanDescription).toBe('Complete description');
    expect(pollCount).toBeGreaterThanOrEqual(2);
  });

  it('returns null when /run fetch fails with network error', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);
    expect(result).toBeNull();
  }, 15_000);

  it('returns null when /run response status is 500', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
    });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);
    expect(result).toBeNull();
  });

  it('retries on 429 and eventually succeeds (ROAD-14)', { timeout: 15000 }, async () => {
    let callCount = 0;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: new Headers(),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            mockSessionState({
              description: 'After retry',
              visual_analysis: {},
              decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
            }),
          ),
      });
    });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);

    expect(result).not.toBeNull();
    expect(result!.humanDescription).toBe('After retry');
    expect(callCount).toBe(2);
  });

  it('retries on 503 and eventually succeeds (ROAD-14)', { timeout: 15000 }, async () => {
    let callCount = 0;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            headers: new Headers(),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            mockSessionState({
              description: 'After 503 retry',
              visual_analysis: {},
              decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
            }),
          ),
      });
    });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);
    expect(result).not.toBeNull();
    expect(callCount).toBe(2);
  });

  it('does not retry on 400 client error', async () => {
    let callCount = 0;
    fetchMock.mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 400,
          headers: new Headers(),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);
    expect(result).toBeNull();
    expect(callCount).toBe(1);
  });

  it('sends X-API-Key header when apiKey is provided (ROAD-13)', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks button',
      visual_analysis: {},
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    await processActionWithBackend(createAction(), '', BACKEND_URL, 'my-secret-key');

    // Verify POST /run has X-API-Key header
    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    expect(postCalls.length).toBe(1);
    const headers = postCalls[0][1].headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('my-secret-key');

    // Verify GET session state also has X-API-Key header
    const getCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => !opts?.method || opts.method === 'GET',
    );
    expect(getCalls.length).toBeGreaterThan(0);
    const getHeaders = getCalls[0][1]?.headers as Record<string, string> | undefined;
    expect(getHeaders?.['X-API-Key']).toBe('my-secret-key');
  });

  it('does not send X-API-Key header when apiKey is omitted (ROAD-13)', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks button',
      visual_analysis: {},
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    await processActionWithBackend(createAction(), '', BACKEND_URL);

    // Verify POST /run does NOT have X-API-Key header
    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    const headers = postCalls[0][1].headers as Record<string, string>;
    expect(headers['X-API-Key']).toBeUndefined();
  });

  it('returns null on 401 unauthorized response (ROAD-13)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL, 'bad-key');
    expect(result).toBeNull();
    // 401 is not retryable, so only 1 call
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses JSON strings in session state output_keys', async () => {
    setupFetchMock(fetchMock, {
      description: 'Fills in the email field',
      visual_analysis: '{"elements":[],"layout":"form","pageContext":{"section":"Login"}}',
      decision_analysis:
        '{"isDecisionPoint":true,"reason":"User can choose login method","branches":[{"condition":"Email","description":"Login with email"}]}',
    });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);

    expect(result).not.toBeNull();
    expect(result!.visualAnalysis).toEqual({
      elements: [],
      layout: 'form',
      pageContext: { section: 'Login' },
    });
    expect(result!.decisionAnalysis).toEqual({
      isDecisionPoint: true,
      reason: 'User can choose login method',
      branches: [{ condition: 'Email', description: 'Login with email' }],
    });
  });

  it('parses visual_grounding from session state (ROAD-28)', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks the Submit button',
      visual_analysis: { elements: [], layout: 'form' },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
      visual_grounding: {
        boundingBox: { y0: 100, x0: 200, y1: 150, x1: 400 },
        annotatedImageBase64: 'data:image/png;base64,annotated',
        elementLabel: 'Button: Submit',
        spatialRelations: ['inside main form'],
        confidence: 0.92,
      },
    });

    const result = await processActionWithBackend(
      createAction({ sessionId: 'sess-grounding' }),
      'data:image/png;base64,abc123',
      BACKEND_URL,
    );

    expect(result).not.toBeNull();
    expect(result!.visualGrounding).toBeDefined();
    expect(result!.visualGrounding!.boundingBox).toEqual({ y0: 100, x0: 200, y1: 150, x1: 400 });
    expect(result!.visualGrounding!.elementLabel).toBe('Button: Submit');
    expect(result!.visualGrounding!.confidence).toBe(0.92);
  });

  it('returns undefined visualGrounding when visual_grounding is missing from state', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks button',
      visual_analysis: { elements: [], layout: 'form' },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);

    expect(result).not.toBeNull();
    expect(result!.visualGrounding).toBeUndefined();
  });

  it('sends prevScreenshotDataUrl as third inlineData part (ROAD-28)', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks the Next button',
      visual_analysis: { elements: [], layout: 'form', stateChange: 'Button became disabled', actionSucceeded: true },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    const result = await processActionWithBackend(
      createAction({ sessionId: 'sess-temporal' }),
      'data:image/png;base64,afterScreenshot',
      BACKEND_URL,
      undefined,
      'data:image/jpeg;base64,beforeScreenshot',
    );

    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    const body = JSON.parse(postCalls[0][1].body as string);
    expect(body.newMessage.parts).toHaveLength(3);
    expect(body.newMessage.parts[0]).toHaveProperty('text');
    expect(body.newMessage.parts[1]).toEqual({
      inlineData: { mimeType: 'image/png', data: 'afterScreenshot' },
    });
    expect(body.newMessage.parts[2]).toEqual({
      inlineData: { mimeType: 'image/jpeg', data: 'beforeScreenshot' },
    });

    expect(result).not.toBeNull();
    expect(result!.visualAnalysis.stateChange).toBe('Button became disabled');
    expect(result!.visualAnalysis.actionSucceeded).toBe(true);
  });

  it('sends only 2 parts when prevScreenshotDataUrl is undefined', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks button',
      visual_analysis: { elements: [], layout: 'form' },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    await processActionWithBackend(
      createAction(),
      'data:image/png;base64,abc',
      BACKEND_URL,
      undefined,
      undefined,
    );

    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    const body = JSON.parse(postCalls[0][1].body as string);
    expect(body.newMessage.parts).toHaveLength(2);
  });

  it('parses boundingBox and codeTrace from visual_analysis (ROAD-28)', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks the Submit button',
      visual_analysis: {
        elements: [{ type: 'button', text: 'Submit', position: 'center' }],
        layout: 'form',
        boundingBox: { y0: 100, x0: 200, y1: 150, x1: 400 },
        codeTrace: 'Cropped region around button, drew bounding box',
      },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    const result = await processActionWithBackend(
      createAction({ sessionId: 'sess-bbox' }),
      'data:image/png;base64,abc123',
      BACKEND_URL,
    );

    expect(result).not.toBeNull();
    expect(result!.visualAnalysis.boundingBox).toEqual({ y0: 100, x0: 200, y1: 150, x1: 400 });
    expect(result!.visualAnalysis.codeTrace).toBe('Cropped region around button, drew bounding box');
  });
});

describe('validateRecordingWithBackend', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns null when backendUrl is empty', async () => {
    const result = await validateRecordingWithBackend(createSession(), [], '');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends correct payload and parses validation_result', async () => {
    const session = createSession({ id: 'sess-v1', stoppedAt: 1700000060000 });
    const actions = [
      createAction({ sequenceNumber: 1, description: 'Click login' }),
      createAction({ id: 'action-2', sequenceNumber: 2, description: 'Fill email' }),
    ];

    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            state: {
              validation_result: {
                overallScore: 8,
                issues: [{ step: 1, type: 'unclear', description: 'Vague' }],
                suggestions: [],
                missingSteps: [],
                summary: 'Good recording',
              },
            },
          }),
      });
    });

    const result = await validateRecordingWithBackend(session, actions, BACKEND_URL);

    // Verify /run request
    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    const body = JSON.parse(postCalls[0][1].body as string);
    expect(body.appName).toBe('doc_validator');
    expect(body.sessionId).toBe('sess-v1');
    const payload = JSON.parse(body.newMessage.parts[0].text);
    expect(payload.steps).toHaveLength(2);

    expect(result).toEqual({
      overallScore: 8,
      issues: [{ step: 1, type: 'unclear', description: 'Vague' }],
      suggestions: [],
      missingSteps: [],
      summary: 'Good recording',
    });
  });

  it('returns null when /run fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
    });
    const result = await validateRecordingWithBackend(createSession(), [], BACKEND_URL);
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const result = await validateRecordingWithBackend(createSession(), [], BACKEND_URL);
    expect(result).toBeNull();
  }, 15_000);

  it('handles JSON string in validation_result', async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            state: {
              validation_result:
                '{"overallScore":7,"issues":[],"suggestions":[],"missingSteps":[],"summary":"OK"}',
            },
          }),
      });
    });

    const result = await validateRecordingWithBackend(createSession(), [], BACKEND_URL);
    expect(result).not.toBeNull();
    expect(result!.overallScore).toBe(7);
    expect(result!.summary).toBe('OK');
  });
});

describe('analyzeComplexAction', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns null when backendUrl is empty', async () => {
    const result = await analyzeComplexAction(createAction(), {}, '', '');
    expect(result).toBeNull();
  });

  it('sends screenshot as inlineData and parses result (ROAD-11)', async () => {
    const action = createAction({ sessionId: 'sess-ca1' });

    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            state: {
              complex_analysis: {
                elements: [{ type: 'button', text: 'Submit', position: 'center' }],
                interactedElement: { type: 'button', text: 'Submit', description: 'Submit button' },
                pageContext: { app: 'App', section: 'Login', workflow: 'Auth' },
                statusIndicators: [],
                layout: 'form',
                confidence: 0.95,
                reasoning: 'Clear button with unique text',
              },
            },
          }),
      });
    });

    const result = await analyzeComplexAction(
      action,
      { layout: 'form' },
      'data:image/jpeg;base64,xyz',
      BACKEND_URL,
    );

    // Verify inlineData in request
    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    const body = JSON.parse(postCalls[0][1].body as string);
    expect(body.appName).toBe('complex_analyzer');
    expect(body.newMessage.parts).toHaveLength(2);
    expect(body.newMessage.parts[1]).toEqual({
      inlineData: { mimeType: 'image/jpeg', data: 'xyz' },
    });

    // Verify text part does NOT include screenshotDataUrl
    const textPart = JSON.parse(body.newMessage.parts[0].text);
    expect(textPart).not.toHaveProperty('screenshotDataUrl');

    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(0.95);
  });

  it('returns null when confidence is missing from result', async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            state: { complex_analysis: { elements: [], layout: 'form' } },
          }),
      });
    });

    const result = await analyzeComplexAction(createAction(), {}, '', BACKEND_URL);
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const result = await analyzeComplexAction(createAction(), {}, '', BACKEND_URL);
    expect(result).toBeNull();
  }, 15_000);
});
