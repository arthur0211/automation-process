import { useEffect, useState } from 'preact/hooks';
import type { RecordingStatus } from '@/lib/types';

export function RecordingControls() {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [actionCount, setActionCount] = useState(0);

  useEffect(() => {
    // Get initial status
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response && !chrome.runtime.lastError) {
        setStatus(response.status);
        setActionCount(response.actionCount || 0);
      }
    });

    // Listen for status updates
    const listener = (message: { type: string; payload?: { status: RecordingStatus; actionCount: number } }) => {
      if (message.type === 'STATUS_UPDATE' && message.payload) {
        setStatus(message.payload.status);
        setActionCount(message.payload.actionCount);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const send = (type: string) => {
    chrome.runtime.sendMessage({ type });
  };

  const statusColors: Record<RecordingStatus, string> = {
    idle: 'bg-gray-400',
    recording: 'bg-red-500 animate-pulse',
    paused: 'bg-yellow-500',
    stopped: 'bg-gray-400',
  };

  const statusLabels: Record<RecordingStatus, string> = {
    idle: 'Ready',
    recording: 'Recording',
    paused: 'Paused',
    stopped: 'Stopped',
  };

  return (
    <div class="p-3 border-b border-gray-200 bg-white">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
          <span class="text-sm font-medium text-gray-700">
            {statusLabels[status]}
          </span>
        </div>
        {status !== 'idle' && (
          <span class="text-xs text-gray-500">{actionCount} steps</span>
        )}
      </div>

      <div class="flex gap-2">
        {status === 'idle' && (
          <button
            onClick={() => send('START_RECORDING')}
            class="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            Start Recording
          </button>
        )}

        {status === 'recording' && (
          <>
            <button
              onClick={() => send('PAUSE_RECORDING')}
              class="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Pause
            </button>
            <button
              onClick={() => send('STOP_RECORDING')}
              class="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-900 transition-colors"
            >
              Stop
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button
              onClick={() => send('RESUME_RECORDING')}
              class="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
            >
              Resume
            </button>
            <button
              onClick={() => send('STOP_RECORDING')}
              class="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-900 transition-colors"
            >
              Stop
            </button>
          </>
        )}

        {status === 'stopped' && (
          <button
            onClick={() => send('START_RECORDING')}
            class="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            New Recording
          </button>
        )}
      </div>
    </div>
  );
}
