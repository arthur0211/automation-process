// Screenshot capture via chrome.tabs.captureVisibleTab
// Must be called from the background service worker context

export async function captureScreenshot(quality = 80): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab({ format: 'jpeg', quality }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(dataUrl);
      }
    });
  });
}
