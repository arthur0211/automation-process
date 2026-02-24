import {
  startCapturing,
  stopCapturing,
  pauseCapturing,
  resumeCapturing,
} from '@/lib/capture/event-capture';
import type {
  ExtensionMessage,
  CaptureSettings,
  StatusPayload,
  RecordingStatus,
} from '@/lib/types';

// ─── Recording Indicator ──────────────────────────────────────────────────────

const INDICATOR_HOST_ID = 'agentic-recorder-indicator';

interface IndicatorState {
  status: RecordingStatus;
  actionCount: number;
  minimized: boolean;
}

let indicatorHost: HTMLElement | null = null;
let indicatorShadow: ShadowRoot | null = null;
let indicatorState: IndicatorState = { status: 'idle', actionCount: 0, minimized: false };

function createIndicator(): void {
  if (indicatorHost) return;

  indicatorHost = document.createElement('div');
  indicatorHost.id = INDICATOR_HOST_ID;
  indicatorHost.setAttribute('data-agentic-recorder-indicator', 'true');
  // Prevent the host element from interfering with page layout
  indicatorHost.style.cssText =
    'position: fixed; z-index: 2147483647; bottom: 16px; right: 16px; pointer-events: auto;';

  indicatorShadow = indicatorHost.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes dot-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.3); }
    }
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: #fff;
      cursor: default;
      user-select: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: opacity 0.2s, transform 0.2s;
      line-height: 1;
      white-space: nowrap;
    }
    .badge--recording {
      background: #ef4444;
      animation: pulse 2s ease-in-out infinite;
    }
    .badge--paused {
      background: #f59e0b;
      animation: none;
    }
    .badge__dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #fff;
      flex-shrink: 0;
    }
    .badge--recording .badge__dot {
      animation: dot-pulse 1.5s ease-in-out infinite;
    }
    .badge__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border: none;
      background: rgba(255,255,255,0.25);
      color: #fff;
      border-radius: 50%;
      font-size: 10px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      margin-left: 4px;
      flex-shrink: 0;
    }
    .badge__close:hover {
      background: rgba(255,255,255,0.45);
    }
    .mini-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      transition: transform 0.2s, width 0.2s, height 0.2s;
    }
    .mini-dot:hover {
      transform: scale(1.8);
    }
    .mini-dot--recording {
      background: #ef4444;
      animation: dot-pulse 1.5s ease-in-out infinite;
    }
    .mini-dot--paused {
      background: #f59e0b;
    }
  `;

  indicatorShadow.appendChild(style);

  const container = document.createElement('div');
  container.className = 'indicator-root';
  indicatorShadow.appendChild(container);

  document.documentElement.appendChild(indicatorHost);
  renderIndicator();
}

function renderIndicator(): void {
  if (!indicatorShadow) return;

  const container = indicatorShadow.querySelector('.indicator-root');
  if (!container) return;

  const { status, actionCount, minimized } = indicatorState;

  if (status !== 'recording' && status !== 'paused') {
    container.innerHTML = '';
    return;
  }

  if (minimized) {
    const stateClass = status === 'recording' ? 'mini-dot--recording' : 'mini-dot--paused';
    container.innerHTML = `<div class="mini-dot ${stateClass}" title="Click to expand recording indicator"></div>`;
    const dot = container.querySelector('.mini-dot') as HTMLElement;
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      indicatorState.minimized = false;
      renderIndicator();
    });
    return;
  }

  const stateClass = status === 'recording' ? 'badge--recording' : 'badge--paused';
  const icon =
    status === 'recording'
      ? '<span class="badge__dot"></span>'
      : '<span style="font-size:11px;">⏸</span>';
  const label = status === 'recording' ? 'REC' : 'Paused';
  const stepsText = actionCount > 0 ? ` · ${actionCount} step${actionCount !== 1 ? 's' : ''}` : '';

  container.innerHTML = `
    <div class="badge ${stateClass}">
      ${icon}
      <span>${label}${stepsText}</span>
      <button class="badge__close" title="Minimize indicator">&times;</button>
    </div>
  `;

  const closeBtn = container.querySelector('.badge__close') as HTMLElement;
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    indicatorState.minimized = true;
    renderIndicator();
  });
}

function updateIndicator(status: RecordingStatus, actionCount: number): void {
  indicatorState.status = status;
  indicatorState.actionCount = actionCount;

  if (status === 'recording' || status === 'paused') {
    if (!indicatorHost) {
      createIndicator();
    } else {
      renderIndicator();
    }
  } else {
    removeIndicator();
  }
}

function removeIndicator(): void {
  if (indicatorHost) {
    indicatorHost.remove();
    indicatorHost = null;
    indicatorShadow = null;
    indicatorState = { status: 'idle', actionCount: 0, minimized: false };
  }
}

// ─── Content Script Entry ──────────────────────────────────────────────────────

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      switch (message.type) {
        case 'PING':
          sendResponse({ pong: true });
          return false;
        case 'START_RECORDING': {
          const payload = message.payload as {
            sessionId: string;
            settings?: Partial<CaptureSettings>;
          };
          startCapturing(payload.sessionId, payload.settings);
          updateIndicator('recording', 0);
          break;
        }
        case 'PAUSE_RECORDING':
          pauseCapturing();
          updateIndicator('paused', indicatorState.actionCount);
          break;
        case 'RESUME_RECORDING':
          resumeCapturing();
          updateIndicator('recording', indicatorState.actionCount);
          break;
        case 'STOP_RECORDING':
          stopCapturing();
          removeIndicator();
          break;
        case 'STATUS_UPDATE': {
          const payload = message.payload as StatusPayload;
          if (payload.status === 'recording' || payload.status === 'paused') {
            updateIndicator(payload.status, payload.actionCount);
          } else if (payload.status === 'stopped' || payload.status === 'idle') {
            removeIndicator();
          }
          break;
        }
      }
    });

    // Auto-register: ask background for current state in case we missed START_RECORDING
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError) return; // background not ready
      if (response && (response.status === 'recording' || response.status === 'paused')) {
        // We're in a recording session — start capturing
        startCapturing(response.sessionId, response.settings);
        updateIndicator(response.status, response.actionCount);
      }
    });
  },
});
