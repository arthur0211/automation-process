import {
  createSession,
  updateSession,
  addAction,
  updateAction,
  getSessionActions,
  saveVideoBlob,
} from '@/lib/storage/db';
import { captureScreenshot } from '@/lib/capture/screenshot';
import { generateDescription } from '@/lib/capture/description-generator';
import type {
  RecordingStatus,
  RecordingSession,
  CapturedAction,
  ExtensionMessage,
  ActionCapturedPayload,
  StatusPayload,
} from '@/lib/types';

// ─── State ──────────────────────────────────────────────────────────────────

let status: RecordingStatus = 'idle';
let currentSession: RecordingSession | null = null;
let actionCount = 0;

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function broadcastStatus() {
  const payload: StatusPayload = {
    status,
    sessionId: currentSession?.id,
    actionCount,
  };
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', payload }).catch(() => {
    // Side panel or popup may not be open
  });
}

// ─── Recording Control ──────────────────────────────────────────────────────

async function startRecording(tabId: number) {
  if (status !== 'idle') return;

  const tab = await chrome.tabs.get(tabId);
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

  // Tell content script to start capturing
  chrome.tabs.sendMessage(tabId, {
    type: 'START_RECORDING',
    payload: { sessionId },
  });

  // Start tab video capture
  await startTabCapture(tabId);

  // Open side panel
  chrome.sidePanel.open({ tabId }).catch(() => {
    // Side panel may not be available
  });

  broadcastStatus();
}

async function pauseRecording(tabId: number) {
  if (status !== 'recording') return;
  status = 'paused';

  chrome.tabs.sendMessage(tabId, { type: 'PAUSE_RECORDING' });
  broadcastStatus();
}

async function resumeRecording(tabId: number) {
  if (status !== 'paused') return;
  status = 'recording';

  chrome.tabs.sendMessage(tabId, { type: 'RESUME_RECORDING' });
  broadcastStatus();
}

async function stopRecording(tabId: number) {
  if (status === 'idle') return;
  status = 'stopped';

  chrome.tabs.sendMessage(tabId, { type: 'STOP_RECORDING' });

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

  // Reset for next recording
  status = 'idle';
  currentSession = null;
  actionCount = 0;
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

async function processAction(payload: ActionCapturedPayload) {
  if (!currentSession || status !== 'recording') return;

  const action = payload.action as CapturedAction;
  action.sessionId = currentSession.id;

  // Generate template description
  action.description = generateDescription(action);

  // Take screenshot
  try {
    const screenshotDataUrl = await captureScreenshot();
    action.screenshotDataUrl = screenshotDataUrl;
  } catch (err) {
    console.warn('Screenshot failed:', err);
  }

  // Store in IndexedDB
  await addAction(action);
  actionCount++;

  // Update session action count
  await updateSession(currentSession.id, { actionCount });

  broadcastStatus();
}

// ─── Message Handler ────────────────────────────────────────────────────────

export default defineBackground({
  main() {
    console.log('Agentic Automation Recorder: background service worker started');

    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, sender, sendResponse) => {
        const tabId = sender.tab?.id;

        switch (message.type) {
          case 'ACTION_CAPTURED':
            processAction(message.payload as ActionCapturedPayload);
            break;

          case 'GET_STATUS':
            sendResponse({
              status,
              sessionId: currentSession?.id,
              actionCount,
            } satisfies StatusPayload);
            break;
        }

        return false;
      },
    );

    // Keyboard shortcuts
    chrome.commands.onCommand.addListener(async (command) => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return;

      switch (command) {
        case 'start-recording':
          if (status === 'idle') await startRecording(tab.id);
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

    // Handle messages from popup/sidepanel for start/stop controls
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, _sender, sendResponse) => {
        (async () => {
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
              sendResponse({ success: true });
              break;
            case 'PAUSE_RECORDING':
              await pauseRecording(tab.id);
              sendResponse({ success: true });
              break;
            case 'RESUME_RECORDING':
              await resumeRecording(tab.id);
              sendResponse({ success: true });
              break;
            case 'STOP_RECORDING':
              await stopRecording(tab.id);
              sendResponse({ success: true });
              break;
          }
        })();

        return true; // async
      },
    );
  },
});
