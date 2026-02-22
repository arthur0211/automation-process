import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { processActionWithBackend } from '@/lib/api/backend-client';
import { createAction } from '../../fixtures';

const BACKEND_URL = 'http://localhost:8000';

function mockSessionState(state: Record<string, unknown>) {
  return {
    id: 'session-1',
    appName: 'recording_pipeline',
    userId: 'extension-user',
    state,
  };
}

describe('processActionWithBackend', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when backendUrl is empty', async () => {
    const result = await processActionWithBackend(createAction(), '', '');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends correct ADK /run request and parses session state', async () => {
    const action = createAction({ sessionId: 'sess-123' });

    // Mock /run response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    // Mock GET session state response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          mockSessionState({
            description: 'Clicks the Submit button on the login form',
            visual_analysis: { elements: [], layout: 'form' },
            decision_analysis: {
              isDecisionPoint: false,
              reason: '',
              branches: [],
            },
          }),
        ),
    });

    const result = await processActionWithBackend(action, 'data:image/png;base64,abc', BACKEND_URL);

    // Verify /run request
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [runUrl, runOpts] = fetchMock.mock.calls[0];
    expect(runUrl).toBe(`${BACKEND_URL}/run`);
    expect(runOpts.method).toBe('POST');

    const body = JSON.parse(runOpts.body);
    expect(body.appName).toBe('recording_pipeline');
    expect(body.userId).toBe('extension-user');
    expect(body.sessionId).toBe('sess-123');
    expect(body.newMessage.role).toBe('user');
    expect(body.newMessage.parts).toHaveLength(1);

    // Verify session GET
    const [sessionUrl] = fetchMock.mock.calls[1];
    expect(sessionUrl).toBe(
      `${BACKEND_URL}/apps/recording_pipeline/users/extension-user/sessions/sess-123`,
    );

    // Verify result
    expect(result).toEqual({
      humanDescription: 'Clicks the Submit button on the login form',
      visualAnalysis: { elements: [], layout: 'form' },
      decisionAnalysis: { isDecisionPoint: false, reason: '', branches: [] },
    });
  });

  it('returns null when /run fetch fails with network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);
    expect(result).toBeNull();
  });

  it('returns null when /run response status is 500', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);
    expect(result).toBeNull();
  });

  it('returns null when session GET fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);
    expect(result).toBeNull();
  });

  it('parses JSON strings in session state output_keys', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          mockSessionState({
            description: 'Fills in the email field',
            visual_analysis: '{"elements":[],"layout":"form","pageContext":{"section":"Login"}}',
            decision_analysis:
              '{"isDecisionPoint":true,"reason":"User can choose login method","branches":[{"condition":"Email","description":"Login with email"}]}',
          }),
        ),
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
});
