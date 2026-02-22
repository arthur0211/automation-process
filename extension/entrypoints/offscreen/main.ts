// Offscreen document for MediaRecorder (tab capture → WebM)
// This receives a stream ID from the background, creates a MediaRecorder,
// and sends back recorded chunks/blob when stopped.

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'START_TAB_CAPTURE': {
      startRecording(message.payload.streamId)
        .then(() => sendResponse({ success: true }))
        .catch((err: Error) => sendResponse({ success: false, error: err.message }));
      return true; // async response
    }

    case 'STOP_TAB_CAPTURE': {
      stopRecording()
        .then((blob) => {
          // Convert blob to base64 for message passing
          const reader = new FileReader();
          reader.onloadend = () => {
            sendResponse({ success: true, dataUrl: reader.result });
          };
          reader.readAsDataURL(blob);
        })
        .catch((err: Error) => sendResponse({ success: false, error: err.message }));
      return true; // async response
    }
  }
});

async function startRecording(streamId: string): Promise<void> {
  const media = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    } as MediaTrackConstraints,
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    } as MediaTrackConstraints,
  });

  recordedChunks = [];

  mediaRecorder = new MediaRecorder(media, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2_500_000,
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.start(1000); // Capture in 1-second chunks
}

async function stopRecording(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      reject(new Error('No active recording'));
      return;
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      recordedChunks = [];

      // Stop all tracks
      mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
      mediaRecorder = null;

      resolve(blob);
    };

    mediaRecorder.stop();
  });
}
