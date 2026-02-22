import { useEffect } from 'preact/hooks';
import { syncFromBackground, handleStatusUpdate } from '../stores/recording-actions';
import type { StatusPayload } from '../types';

export function useBackgroundSync() {
  useEffect(() => {
    syncFromBackground();

    const listener = (message: { type: string; payload?: StatusPayload }) => {
      if (message.type === 'STATUS_UPDATE' && message.payload) {
        handleStatusUpdate(message.payload);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
}
