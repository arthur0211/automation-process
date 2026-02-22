import {
  startCapturing,
  stopCapturing,
  pauseCapturing,
  resumeCapturing,
} from '@/lib/capture/event-capture';
import type { ExtensionMessage, CaptureSettings } from '@/lib/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, _sender, _sendResponse) => {
        switch (message.type) {
          case 'START_RECORDING': {
            const payload = message.payload as { sessionId: string; settings?: Partial<CaptureSettings> };
            startCapturing(payload.sessionId, payload.settings);
            break;
          }
          case 'PAUSE_RECORDING':
            pauseCapturing();
            break;
          case 'RESUME_RECORDING':
            resumeCapturing();
            break;
          case 'STOP_RECORDING':
            stopCapturing();
            break;
        }
      },
    );
  },
});
