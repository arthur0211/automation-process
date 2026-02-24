import {
  createSession,
  updateSession,
  addAction,
  updateAction,
  getSessionActions,
  getActionBySequence,
  saveVideoBlob,
} from '@/lib/storage/db';
import { captureScreenshot } from '@/lib/capture/screenshot';
import { generateDescription } from '@/lib/capture/description-generator';
import { analyzeComplexAction } from '@/lib/api/backend-client';
import type { ValidationProvider } from '@/lib/api/enrichment-provider';
import type {
  RecordingStatus,
  RecordingSession,
  CapturedAction,
  ExtensionMessage,
  ActionCapturedPayload,
  StatusPayload,
  CaptureSettings,
  VisualAnalysis,
} from '@/lib/types';
import { DEFAULT_CAPTURE_SETTINGS } from '@/lib/types';
import { getSession } from '@/lib/storage/db';

// ─── State ──────────────────────────────────────────────────────────────────

let status: RecordingStatus = 'idle';
let currentSession: RecordingSession | null = null;
let actionCount = 0;
let currentSettings: CaptureSettings = { ...DEFAULT_CAPTURE_SETTINGS };

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Persist state to survive service worker termination (MV3)
async function saveState() {
  await chrome.storage.session.set({
    swState: {
      status,
      sessionId: currentSession?.id || null,
      actionCount,
    },
  });
}

async function loadState() {
  const result = await chrome.storage.session.get('swState');
  const saved = result.swState as
    | { status: RecordingStatus; sessionId: string | null; actionCount: number }
    | undefined;
  if (!saved) return;
  status = saved.status;
  actionCount = saved.actionCount;
  if (saved.sessionId) {
    const s = await getSession(saved.sessionId);
    if (s) currentSession = s;
  }
}

function broadcastStatus() {
  const payload: StatusPayload = {
    status,
    sessionId: currentSession?.id,
    actionCount,
  };
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', payload }).catch((err) => {
    console.debug('broadcastStatus: no receiver (popup/sidepanel may be closed):', err?.message);
  });
}

// ─── Recording Control ──────────────────────────────────────────────────────

async function startRecording(tabId: number) {
  if (status !== 'idle' && status !== 'stopped') return;

  // Reset previous session state
  currentSession = null;
  actionCount = 0;

  // Load user settings from chrome.storage.local
  const stored = await chrome.storage.local.get('settings');
  currentSettings = {
    ...DEFAULT_CAPTURE_SETTINGS,
    ...(stored.settings as Partial<CaptureSettings>),
  };
  // Clamp settings to valid bounds
  currentSettings.screenshotQuality = Math.max(
    10,
    Math.min(100, currentSettings.screenshotQuality),
  );

  const tab = await chrome.tabs.get(tabId);
  lastActiveTabId = tabId;
  const sessionId = generateSessionId();

  currentSession = {
    id: sessionId,
    name: `Recording ${new Date().toLocaleString()}`,
    startedAt: Date.now(),
    status: 'recording',
    url: tab.url || '',
    actionCount: 0,
  };

  await createSession(currentSession);
  actionCount = 0;
  status = 'recording';

  // Tell ALL tabs to start capturing (multi-tab support)
  await sendToAllTabs({
    type: 'START_RECORDING',
    payload: { sessionId, settings: currentSettings },
  });

  // Start tab video capture
  await startTabCapture(tabId);

  // Open side panel
  chrome.sidePanel.open({ tabId }).catch((err) => {
    console.debug('sidePanel.open failed:', err?.message);
  });

  broadcastStatus();
  saveState();
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      });
      return true;
    } catch (err) {
      console.warn(`Cannot inject content script into tab ${tabId}:`, err);
      return false;
    }
  }
}

async function sendToAllTabs(message: ExtensionMessage) {
  const allTabs = await chrome.tabs.query({});
  await Promise.allSettled(
    allTabs
      .filter((t) => t.id && t.url && /^https?:\/\//.test(t.url))
      .map(async (t) => {
        try {
          await ensureContentScript(t.id!);
          await chrome.tabs.sendMessage(t.id!, message);
        } catch (err) {
          console.warn(`Failed to send message to tab ${t.id} (${t.url}):`, err);
        }
      }),
  );
}

async function pauseRecording(_tabId: number) {
  if (status !== 'recording') return;
  status = 'paused';

  await sendToAllTabs({ type: 'PAUSE_RECORDING' });
  broadcastStatus();
  saveState();
}

async function resumeRecording(_tabId: number) {
  if (status !== 'paused') return;
  status = 'recording';

  await sendToAllTabs({ type: 'RESUME_RECORDING' });
  broadcastStatus();
  saveState();
}

async function stopRecording(_tabId: number) {
  if (status === 'idle') return;
  status = 'stopped';

  await sendToAllTabs({ type: 'STOP_RECORDING' });

  // Stop tab capture and save video
  await stopTabCapture();

  if (currentSession) {
    await updateSession(currentSession.id, {
      status: 'stopped',
      stoppedAt: Date.now(),
      actionCount,
    });
  }

  broadcastStatus();
  saveState();

  // Async validation — does not block stop
  if (currentSession) {
    validateRecordingInBackground(currentSession.id);
  }
}

// ─── Tab Capture (Video Recording) ─────────────────────────────────────────

let offscreenCreated = false;

async function ensureOffscreen() {
  if (offscreenCreated) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Recording tab video via MediaRecorder',
    });
    offscreenCreated = true;
  } catch {
    // Already exists
    offscreenCreated = true;
  }
}

async function startTabCapture(tabId: number) {
  try {
    await ensureOffscreen();

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });

    await chrome.runtime.sendMessage({
      type: 'START_TAB_CAPTURE',
      payload: { streamId },
    });
  } catch (err) {
    console.error('Failed to start tab capture:', err);
  }
}

async function stopTabCapture() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'STOP_TAB_CAPTURE',
    });

    if (response?.success && response.dataUrl && currentSession) {
      // Convert data URL to blob and save
      const res = await fetch(response.dataUrl);
      const blob = await res.blob();
      await saveVideoBlob(currentSession.id, blob);
    }
  } catch (err) {
    console.error('Failed to stop tab capture:', err);
  }
}

// ─── Action Processing ──────────────────────────────────────────────────────

async function processAction(
  payload: ActionCapturedPayload,
  senderTabId?: number,
  senderTabTitle?: string,
) {
  if (!currentSession || status !== 'recording') return;

  const action = payload.action as CapturedAction;
  action.sessionId = currentSession.id;
  if (senderTabId !== undefined) action.tabId = senderTabId;
  if (senderTabTitle) action.tabTitle = senderTabTitle;

  // Background owns sequence numbering (prevents multi-tab collisions)
  actionCount++;
  action.sequenceNumber = actionCount;

  // Generate template description
  action.description = generateDescription(action);

  // Take screenshot
  try {
    const screenshotDataUrl = await captureScreenshot(currentSettings.screenshotQuality);
    action.screenshotDataUrl = screenshotDataUrl;
  } catch (err) {
    console.warn('Screenshot failed:', err);
  }

  // Store in IndexedDB
  await addAction(action);

  // Update session action count
  await updateSession(currentSession.id, { actionCount });

  broadcastStatus();
  saveState();

  // Async enrichment — does not block action storage
  enrichActionInBackground(action);
}

const COMPLEX_ANALYSIS_CONFIDENCE_THRESHOLD = 0.5;

async function enrichActionInBackground(action: CapturedAction) {
  try {
    const { getEnrichmentProvider } = await import('@/lib/api/enrichment-provider');
    const provider = await getEnrichmentProvider();
    if (!provider) return;

    // Look up previous action for temporal context (before/after)
    let prevScreenshotDataUrl: string | undefined;
    if (action.sequenceNumber > 1) {
      const prevAction = await getActionBySequence(action.sessionId, action.sequenceNumber - 1);
      prevScreenshotDataUrl = prevAction?.screenshotDataUrl;
    }

    const enriched = await provider.enrichAction(
      action,
      action.screenshotDataUrl || '',
      prevScreenshotDataUrl,
    );
    if (!enriched) return;

    const changes: Partial<CapturedAction> = {
      llmDescription: enriched.humanDescription,
      llmVisualAnalysis: enriched.visualAnalysis,
      enrichmentSource: provider.name === 'gemini-direct' ? 'gemini-direct' : 'adk-backend',
      ...(enriched.visualGrounding && { visualGrounding: enriched.visualGrounding }),
    };

    if (enriched.decisionAnalysis.isDecisionPoint) {
      changes.decisionPoint = enriched.decisionAnalysis;
    }

    await updateAction(action.id, changes);
    broadcastStatus();

    // Trigger complex analysis for low-confidence selectors (backend provider only)
    if (
      provider.capabilities.complexAnalysis &&
      action.element.selectors.confidence !== undefined &&
      action.element.selectors.confidence < COMPLEX_ANALYSIS_CONFIDENCE_THRESHOLD
    ) {
      analyzeComplexActionInBackground(action, enriched.visualAnalysis);
    }
  } catch (err) {
    console.warn('Background enrichment failed:', err);
  }
}

async function validateRecordingInBackground(sessionId: string) {
  try {
    const { getEnrichmentProvider } = await import('@/lib/api/enrichment-provider');
    const provider = await getEnrichmentProvider();
    if (!provider || !provider.capabilities.docValidation) return;

    // Check if provider supports validation (implements validateRecording)
    if (!('validateRecording' in provider)) return;

    await updateSession(sessionId, { validationStatus: 'running' });
    broadcastStatus();

    const session = await getSession(sessionId);
    if (!session) return;
    const actions = await getSessionActions(sessionId);

    const validationResult = await (provider as unknown as ValidationProvider).validateRecording(
      session,
      actions,
    );

    if (validationResult) {
      await updateSession(sessionId, { validationResult, validationStatus: 'done' });
    } else {
      await updateSession(sessionId, { validationStatus: 'error' });
    }
    broadcastStatus();
  } catch (err) {
    console.warn('Background validation failed:', err);
    await updateSession(sessionId, { validationStatus: 'error' }).catch(() => {});
    broadcastStatus();
  }
}

async function analyzeComplexActionInBackground(
  action: CapturedAction,
  originalAnalysis: VisualAnalysis,
) {
  try {
    const result = await chrome.storage.local.get(['standaloneAgentsUrl', 'backendApiKey']);
    const agentsUrl = result.standaloneAgentsUrl as string | undefined;
    if (!agentsUrl) return;
    const apiKey = result.backendApiKey as string | undefined;

    const complexResult = await analyzeComplexAction(
      action,
      originalAnalysis,
      action.screenshotDataUrl || '',
      agentsUrl,
      apiKey,
    );
    if (!complexResult) return;

    // Only replace if complex analysis has higher confidence
    if (complexResult.confidence > (action.element.selectors.confidence || 0)) {
      await updateAction(action.id, {
        llmVisualAnalysis: complexResult,
      });
      broadcastStatus();
    }
  } catch (err) {
    console.warn('Complex analysis failed:', err);
  }
}

// ─── Tab Switch Detection ────────────────────────────────────────────────────

function emptyElementMetadata(): CapturedAction['element'] {
  return {
    tag: 'document',
    id: '',
    classes: [],
    text: '',
    role: '',
    ariaLabel: '',
    name: '',
    type: '',
    href: '',
    placeholder: '',
    boundingBox: { x: 0, y: 0, width: 0, height: 0 },
    selectors: { css: 'html', xpath: '/html' },
  };
}

let lastActiveTabId: number | null = null;

async function handleTabSwitch(activeInfo: { tabId: number; windowId: number }) {
  if (status !== 'recording' || !currentSession) return;
  if (activeInfo.tabId === lastActiveTabId) return;
  lastActiveTabId = activeInfo.tabId;

  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(activeInfo.tabId); // Single call
  } catch {
    return; // Tab may not exist
  }

  // Ensure the new tab has content script capturing
  // (new tabs opened during recording never received START_RECORDING)
  if (tab.url && /^https?:\/\//.test(tab.url)) {
    await ensureContentScript(activeInfo.tabId);
    await chrome.tabs
      .sendMessage(activeInfo.tabId, {
        type: 'START_RECORDING',
        payload: { sessionId: currentSession.id, settings: currentSettings },
      })
      .catch(() => {});
  }

  // Create navigate action
  const tabUrl = tab.url || tab.pendingUrl || '';
  if (!tabUrl) return; // Don't create action with empty URL

  actionCount++;
  try {
    const action: CapturedAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sessionId: currentSession.id,
      timestamp: Date.now(),
      sequenceNumber: actionCount,
      actionType: 'navigate',
      url: tabUrl,
      pageTitle: tab.title || '',
      element: emptyElementMetadata(),
      description: '',
      note: '',
      decisionPoint: { isDecisionPoint: false, reason: '', branches: [] },
      tabId: tab.id,
      tabTitle: tab.title,
    };

    action.description = generateDescription(action);

    // Screenshot may capture previous tab due to rendering timing
    try {
      const screenshotDataUrl = await captureScreenshot(currentSettings.screenshotQuality);
      action.screenshotDataUrl = screenshotDataUrl;
    } catch {
      // Screenshot may fail during tab switch
    }

    await addAction(action);
    await updateSession(currentSession.id, { actionCount });
    broadcastStatus();
    saveState();
  } catch (err) {
    actionCount--; // Rollback on failure
    console.warn('Tab switch action failed:', err);
  }
}

// ─── Message Handler ────────────────────────────────────────────────────────

export default defineBackground({
  main() {
    console.log('Agentic Automation Recorder: background service worker started');

    // Restore state from session storage (survives SW termination)
    const stateReady = loadState().catch((err) => {
      console.error('Failed to load state:', err);
    });

    // Unified message handler
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
      switch (message.type) {
        // ─── Sync handlers (content script & status queries) ──────────
        case 'ACTION_CAPTURED':
          stateReady.then(() => {
            processAction(
              message.payload as ActionCapturedPayload,
              sender.tab?.id,
              sender.tab?.title,
            );
          });
          return false;

        case 'GET_STATUS':
          stateReady.then(() => {
            sendResponse({
              status,
              sessionId: currentSession?.id,
              actionCount,
              settings: currentSettings,
            } satisfies StatusPayload);
          });
          return true; // async response

        case 'RESET_RECORDING':
          status = 'idle';
          currentSession = null;
          actionCount = 0;
          broadcastStatus();
          saveState();
          sendResponse({ success: true });
          return false;

        // ─── Async handlers (recording controls from popup/sidepanel) ─
        case 'START_RECORDING':
        case 'PAUSE_RECORDING':
        case 'RESUME_RECORDING':
        case 'STOP_RECORDING': {
          (async () => {
            await stateReady;
            const [tab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (!tab?.id) {
              sendResponse({ error: 'No active tab' });
              return;
            }
            switch (message.type) {
              case 'START_RECORDING':
                await startRecording(tab.id);
                break;
              case 'PAUSE_RECORDING':
                await pauseRecording(tab.id);
                break;
              case 'RESUME_RECORDING':
                await resumeRecording(tab.id);
                break;
              case 'STOP_RECORDING':
                await stopRecording(tab.id);
                break;
            }
            sendResponse({ success: true });
          })();
          return true; // async response
        }

        default:
          return false;
      }
    });

    // Tab switch detection for multi-tab recording
    chrome.tabs.onActivated.addListener(handleTabSwitch);

    // Keyboard shortcuts
    chrome.commands.onCommand.addListener(async (command) => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return;

      switch (command) {
        case 'start-recording':
          if (status === 'idle' || status === 'stopped') await startRecording(tab.id);
          break;
        case 'pause-recording':
          if (status === 'recording') await pauseRecording(tab.id);
          else if (status === 'paused') await resumeRecording(tab.id);
          break;
        case 'stop-recording':
          if (status !== 'idle') await stopRecording(tab.id);
          break;
      }
    });
  },
});
