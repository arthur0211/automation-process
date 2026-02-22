import {
  startCapturing,
  stopCapturing,
  pauseCapturing,
  resumeCapturing,
} from '@/lib/capture/event-capture';
import type { ExtensionMessage } from '@/lib/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, _sender, _sendResponse) => {
        switch (message.type) {
          case 'START_RECORDING': {
            const payload = message.payload as { sessionId: string };
            startCapturing(payload.sessionId);
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
