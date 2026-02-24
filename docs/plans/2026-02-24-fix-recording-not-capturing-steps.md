# Fix Recording Not Capturing Steps — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the critical bug where recording starts but no steps are captured, caused by content scripts not being injected in pre-existing tabs and race conditions in the service worker lifecycle.

**Architecture:** Three-layer fix — (1) add missing permissions and dynamic content script injection, (2) fix service worker race condition where ACTION_CAPTURED doesn't await state restoration, (3) add error handling and observability to silent failure points.

**Tech Stack:** Chrome Extension MV3, WXT, TypeScript, chrome.scripting API, chrome.storage.session

---

### Task 1: Add missing permissions to manifest

**Files:**
- Modify: `extension/wxt.config.ts:17-24`

**Step 1: Add `tabs` and `scripting` permissions**

In `extension/wxt.config.ts`, replace the permissions array (lines 17-24):

```typescript
permissions: [
  'activeTab',
  'tabs',
  'scripting',
  'tabCapture',
  'offscreen',
  'storage',
  'unlimitedStorage',
  'sidePanel',
],
```

- `tabs` — required for `chrome.tabs.query({})` to return full tab info (url, title) and for `chrome.tabs.sendMessage` to work reliably across all tabs
- `scripting` — required for `chrome.scripting.executeScript()` to dynamically inject content scripts into pre-existing tabs

**Step 2: Build and verify manifest**

Run: `cd extension && npx wxt build`
Expected: Build succeeds, `.output/chrome-mv3/manifest.json` contains `"tabs"` and `"scripting"` in permissions array.

**Step 3: Commit**

```bash
git add extension/wxt.config.ts
git commit -m "fix(extension): add tabs and scripting permissions to manifest

Missing permissions caused sendToAllTabs to fail silently and prevented
dynamic content script injection into pre-existing tabs."
```

---

### Task 2: Inject content script dynamically into pre-existing tabs

**Files:**
- Modify: `extension/entrypoints/background.ts:79-140`

**Step 1: Add `ensureContentScript` helper function**

Insert after the `sendToAllTabs` function (after line 140 in `background.ts`):

```typescript
async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    // Ping the content script to check if it's already injected
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch {
    // Content script not present — inject it dynamically
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
```

**Step 2: Add PING handler to content script**

In `extension/entrypoints/content.ts`, add a PING case inside the switch (after line 30):

```typescript
case 'PING':
  _sendResponse({ pong: true });
  return;
```

And change the listener return to `true` for async response support. The full listener becomes:

```typescript
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      sendResponse({ pong: true });
      return true;
    case 'START_RECORDING': {
      const payload = message.payload as {
        sessionId: string;
        settings?: Partial<CaptureSettings>;
      };
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
});
```

**Step 3: Update `sendToAllTabs` to ensure injection before sending**

Replace `sendToAllTabs` in `background.ts` (lines 133-140):

```typescript
async function sendToAllTabs(message: ExtensionMessage) {
  const allTabs = await chrome.tabs.query({});
  for (const t of allTabs) {
    if (!t.id || !t.url) continue;
    // Skip chrome://, about:, edge://, chrome-extension:// pages
    if (!/^https?:\/\//.test(t.url)) continue;
    try {
      await ensureContentScript(t.id);
      await chrome.tabs.sendMessage(t.id, message);
    } catch (err) {
      console.warn(`Failed to send message to tab ${t.id} (${t.url}):`, err);
    }
  }
}
```

**Step 4: Build and type-check**

Run: `cd extension && npx tsc --noEmit && npx wxt build`
Expected: No type errors, build succeeds.

**Step 5: Commit**

```bash
git add extension/entrypoints/background.ts extension/entrypoints/content.ts
git commit -m "fix(extension): inject content script dynamically into pre-existing tabs

Content scripts declared with matches only inject on new page loads.
Tabs already open when extension is installed/reloaded never receive the
content script, causing sendToAllTabs to fail silently.

Now ensureContentScript pings first, then injects via chrome.scripting
if needed. Also filters out chrome:// and other restricted URLs."
```

---

### Task 3: Fix ACTION_CAPTURED race condition with stateReady

**Files:**
- Modify: `extension/entrypoints/background.ts:471-477`

**Step 1: Make ACTION_CAPTURED await stateReady before processing**

Replace the `ACTION_CAPTURED` case in the message handler (lines 471-477):

```typescript
case 'ACTION_CAPTURED':
  stateReady.then(() => {
    processAction(
      message.payload as ActionCapturedPayload,
      sender.tab?.id,
      sender.tab?.title,
    );
  });
  return false;
```

This ensures that when the service worker wakes from termination, `loadState()` completes (restoring `currentSession` and `status`) before `processAction` checks `if (!currentSession || status !== 'recording') return;`.

**Step 2: Build and type-check**

Run: `cd extension && npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add extension/entrypoints/background.ts
git commit -m "fix(extension): await stateReady before processing ACTION_CAPTURED

When the MV3 service worker terminates and wakes on an ACTION_CAPTURED
message, in-memory state (status, currentSession) is still at defaults.
processAction silently dropped actions because currentSession was null.
Now awaits stateReady promise before processing."
```

---

### Task 4: Add error handling to sendAction in content script

**Files:**
- Modify: `extension/lib/capture/event-capture.ts:86-91`

**Step 1: Add .catch() to sendAction**

Replace `sendAction` (lines 86-91):

```typescript
function sendAction(action: CapturedAction) {
  chrome.runtime.sendMessage({
    type: 'ACTION_CAPTURED',
    payload: { action },
  }).catch((err) => {
    console.warn('sendAction failed (service worker may be inactive):', err);
  });
}
```

**Step 2: Type-check**

Run: `cd extension && npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add extension/lib/capture/event-capture.ts
git commit -m "fix(extension): add error handling to sendAction in content script

chrome.runtime.sendMessage silently failed when the service worker was
inactive, losing captured actions with no indication."
```

---

### Task 5: Replace silent .catch(() => {}) with diagnostic logging

**Files:**
- Modify: `extension/entrypoints/background.ts:72,125,137`

**Step 1: Add diagnostic logging to broadcastStatus catch**

Line 72 — replace `.catch(() => {` with:

```typescript
chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', payload }).catch((err) => {
  console.debug('broadcastStatus: no receiver (popup/sidepanel may be closed):', err?.message);
});
```

**Step 2: Add diagnostic logging to sidePanel.open catch**

Line 125 — replace `.catch(() => {` with:

```typescript
chrome.sidePanel.open({ tabId }).catch((err) => {
  console.debug('sidePanel.open failed:', err?.message);
});
```

Note: The `sendToAllTabs` catch at line 137 was already replaced with diagnostic logging in Task 2.

**Step 3: Type-check**

Run: `cd extension && npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add extension/entrypoints/background.ts
git commit -m "fix(extension): replace silent catch handlers with diagnostic logging

Silent .catch(() => {}) made debugging impossible. Now logs context-specific
warnings for broadcastStatus and sidePanel.open failures."
```

---

### Task 6: Run full test suite and verify build

**Step 1: Run all tests**

Run: `cd extension && npx vitest run`
Expected: All 341+ tests pass.

**Step 2: Type-check entire project**

Run: `cd extension && npx tsc --noEmit`
Expected: 0 errors.

**Step 3: Production build**

Run: `cd extension && npx wxt build`
Expected: Build succeeds. Check `.output/chrome-mv3/manifest.json` has `tabs` and `scripting` permissions.

**Step 4: Verify content script file exists in output**

Run: `ls extension/.output/chrome-mv3/content-scripts/content.js`
Expected: File exists (this is the file path referenced in `ensureContentScript`).

---

### Task 7: Manual smoke test

**Step 1: Load extension in Chrome**

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" → select `extension/.output/chrome-mv3`

**Step 2: Test the fix**

1. Open Gmail (or any page) in a tab **before** loading the extension
2. Load/reload the extension
3. Click the extension icon → "Start Recording"
4. Click elements on the page
5. Verify steps appear in the SidePanel

**Step 3: Test restricted page handling**

1. Navigate to `chrome://settings`
2. Start recording
3. Click elements — no steps should appear (expected, restricted page)
4. Navigate to a normal website — steps should now capture correctly

---

## Summary of Changes

| File | Change | Root Cause Addressed |
|---|---|---|
| `wxt.config.ts` | Add `tabs`, `scripting` permissions | sendToAllTabs broken without tabs permission |
| `background.ts` | Add `ensureContentScript()`, update `sendToAllTabs`, fix `ACTION_CAPTURED` await, add logging | Content script not injected in pre-existing tabs; SW race condition; silent errors |
| `content.ts` | Add `PING` handler, return `true` for async | Enable ping-based injection detection |
| `event-capture.ts` | Add `.catch()` to `sendAction` | Actions silently lost when SW inactive |
