import { useEffect, useState } from 'preact/hooks';
import type { RecordingStatus } from '@/lib/types';

export function Popup() {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [actionCount, setActionCount] = useState(0);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response && !chrome.runtime.lastError) {
        setStatus(response.status);
        setActionCount(response.actionCount || 0);
      }
    });

    const listener = (message: { type: string; payload?: { status: RecordingStatus; actionCount: number } }) => {
      if (message.type === 'STATUS_UPDATE' && message.payload) {
        setStatus(message.payload.status);
        setActionCount(message.payload.actionCount);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const send = (type: string) => chrome.runtime.sendMessage({ type });

  function openSidePanel() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }); // wake up service worker
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.sidePanel.open({ tabId: tab.id });
      }
    });
  }

  const statusColors: Record<RecordingStatus, string> = {
    idle: 'bg-gray-400',
    recording: 'bg-red-500 animate-pulse',
    paused: 'bg-yellow-500',
    stopped: 'bg-gray-400',
  };

  const statusLabels: Record<RecordingStatus, string> = {
    idle: 'Ready to record',
    recording: `Recording (${actionCount} steps)`,
    paused: `Paused (${actionCount} steps)`,
    stopped: 'Stopped',
  };

  return (
    <div class="w-72 p-4 space-y-3">
      <div class="flex items-center gap-2">
        <h1 class="text-sm font-bold text-gray-900 flex-1">Agentic Automation</h1>
        <span class={`w-2 h-2 rounded-full ${statusColors[status]}`} />
      </div>

      <p class="text-xs text-gray-500">{statusLabels[status]}</p>

      <div class="flex flex-col gap-2">
        {status === 'idle' && (
          <button
            onClick={() => send('START_RECORDING')}
            class="w-full px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            Start Recording
          </button>
        )}

        {status === 'recording' && (
          <div class="flex gap-2">
            <button
              onClick={() => send('PAUSE_RECORDING')}
              class="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Pause
            </button>
            <button
              onClick={() => send('STOP_RECORDING')}
              class="flex-1 px-3 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-900"
            >
              Stop
            </button>
          </div>
        )}

        {status === 'paused' && (
          <div class="flex gap-2">
            <button
              onClick={() => send('RESUME_RECORDING')}
              class="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              Resume
            </button>
            <button
              onClick={() => send('STOP_RECORDING')}
              class="flex-1 px-3 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-900"
            >
              Stop
            </button>
          </div>
        )}

        {status === 'stopped' && (
          <button
            onClick={() => send('START_RECORDING')}
            class="w-full px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            New Recording
          </button>
        )}

        <button
          onClick={openSidePanel}
          class="w-full px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
        >
          Open Review Panel
        </button>
      </div>

      <div class="text-[10px] text-gray-300 text-center">
        Ctrl+Shift+R Start | Ctrl+Shift+P Pause | Ctrl+Shift+S Stop
      </div>
    </div>
  );
}
