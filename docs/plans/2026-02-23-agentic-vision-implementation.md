# Agentic Vision Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Gemini 3 Agentic Vision (code execution + thinking) on the screenshot analysis pipeline, in 3 incremental phases.

**Architecture:** Add `BuiltInCodeExecutionTool` to existing `screenshot_analyzer` (Phase 1), create a dedicated `visual_grounder` agent for bounding boxes and annotated screenshots (Phase 2), then add before/after temporal context (Phase 3). Each phase is independently deployable.

**Tech Stack:** Google ADK (`BuiltInCodeExecutionTool`), Gemini 3 Flash (`gemini-3-flash-preview`), Vitest, TypeScript 5.9

**Design doc:** `docs/plans/2026-02-23-agentic-vision-integration-design.md`

---

## Phase 1: Drop-in Agentic Vision on screenshot_analyzer

### Task 1: Enable code execution on screenshot_analyzer agent

**Files:**
- Modify: `backend/agents/screenshot_analyzer.py` (entire file, 25 lines)

**Step 1: Update the agent with BuiltInCodeExecutionTool**

Replace the entire file content with:

```python
import os

from google.adk.agents import LlmAgent
from google.adk.tools import BuiltInCodeExecutionTool

screenshot_analyzer = LlmAgent(
    name="screenshot_analyzer",
    model=os.environ.get("GEMINI_FLASH_MODEL", "gemini-3-flash-preview"),
    instruction="""Analyze the screenshot of a web browser tab during a recorded user session.

You have code execution available. Use it when beneficial:
- Zoom/crop into small text (input values, tooltips, labels, error messages) for accurate reading
- Draw a bounding box around the interacted element and report normalized coordinates (0-1000 scale)
- Count elements deterministically when multiples are visible
- Annotate the image to highlight the interacted element

Analyze and extract:
1. All visible UI elements (buttons, inputs, links, text fields)
2. The element that was interacted with — identify it precisely
3. Page context (what section, what application, what workflow)
4. Any visible error messages or status indicators
5. Visual hierarchy and layout information
6. Bounding box of the interacted element (normalized 0-1000 coordinates: [y0, x0, y1, x1])

Output as structured JSON:
{
  "elements": [{"type": "button|input|link|text|...", "text": "...", "position": "top-left|center|..."}],
  "interactedElement": {"type": "...", "text": "...", "description": "..."},
  "pageContext": {"app": "...", "section": "...", "workflow": "..."},
  "statusIndicators": ["..."],
  "layout": "form|list|dashboard|...",
  "boundingBox": {"y0": 0, "x0": 0, "y1": 0, "x1": 0},
  "codeTrace": "brief summary of code operations performed, or null if none"
}

IMPORTANT: Always output valid JSON. The boundingBox and codeTrace fields are optional — include them only when you used code execution to determine them. Never omit the core fields (elements, interactedElement, pageContext, statusIndicators, layout).""",
    output_key="visual_analysis",
    tools=[BuiltInCodeExecutionTool()],
)
```

**Step 2: Verify backend loads without errors**

Run: `cd /e/Downloads/agentic-automation/backend && python -c "from agents import root_agent; print(f'Agent: {root_agent.name}, sub_agents: {[a.name for a in root_agent.sub_agents]}')"`
Expected: `Agent: action_processor, sub_agents: ['screenshot_analyzer', 'description_generator', 'decision_detector']`

**Step 3: Commit**

```bash
git add backend/agents/screenshot_analyzer.py
git commit -m "feat(backend): enable Agentic Vision on screenshot_analyzer (ROAD-28)

Add BuiltInCodeExecutionTool to screenshot_analyzer agent, enabling
the Think-Act-Observe loop for zoom/crop, bounding box detection,
and deterministic element counting via code execution.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add boundingBox and codeTrace to VisualAnalysis TypeScript interface

**Files:**
- Modify: `extension/lib/types.ts:87-95`
- Test: `extension/test/lib/api/backend-client.test.ts`

**Step 1: Write the failing test**

Add this test at the end of the `processActionWithBackend` describe block in `extension/test/lib/api/backend-client.test.ts` (after line 373, before the closing `});`):

```typescript
  it('parses boundingBox and codeTrace from visual_analysis (ROAD-28)', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks the Submit button',
      visual_analysis: {
        elements: [{ type: 'button', text: 'Submit', position: 'center' }],
        layout: 'form',
        boundingBox: { y0: 100, x0: 200, y1: 150, x1: 400 },
        codeTrace: 'Cropped region around button, drew bounding box',
      },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    const result = await processActionWithBackend(
      createAction({ sessionId: 'sess-bbox' }),
      'data:image/png;base64,abc123',
      BACKEND_URL,
    );

    expect(result).not.toBeNull();
    expect(result!.visualAnalysis.boundingBox).toEqual({ y0: 100, x0: 200, y1: 150, x1: 400 });
    expect(result!.visualAnalysis.codeTrace).toBe('Cropped region around button, drew bounding box');
  });
```

**Step 2: Run test to verify it fails**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run test/lib/api/backend-client.test.ts`
Expected: FAIL — `Property 'boundingBox' does not exist on type 'VisualAnalysis'`

**Step 3: Add fields to VisualAnalysis interface**

In `extension/lib/types.ts`, modify lines 87-95. Replace:

```typescript
export interface VisualAnalysis {
  elements?: { type: string; text: string; position: string }[];
  interactedElement?: { type: string; text: string; description: string };
  pageContext?: { app?: string; section?: string; workflow?: string };
  statusIndicators?: string[];
  layout?: string;
  confidence?: number;
  reasoning?: string;
}
```

With:

```typescript
export interface VisualAnalysis {
  elements?: { type: string; text: string; position: string }[];
  interactedElement?: { type: string; text: string; description: string };
  pageContext?: { app?: string; section?: string; workflow?: string };
  statusIndicators?: string[];
  layout?: string;
  confidence?: number;
  reasoning?: string;
  boundingBox?: { y0: number; x0: number; y1: number; x1: number };
  codeTrace?: string;
}
```

**Step 4: Run test to verify it passes**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run test/lib/api/backend-client.test.ts`
Expected: ALL PASS

**Step 5: Run full test suite + type check**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run && npx tsc --noEmit`
Expected: 341+ tests pass, 0 type errors

**Step 6: Commit**

```bash
git add extension/lib/types.ts extension/test/lib/api/backend-client.test.ts
git commit -m "feat(extension): add boundingBox and codeTrace to VisualAnalysis (ROAD-28)

Support new optional fields from Agentic Vision code execution:
boundingBox (normalized 0-1000 coords) and codeTrace (audit trail).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 2: Visual Grounding Agent

### Task 3: Create visual_grounder backend agent

**Files:**
- Create: `backend/agents/visual_grounder.py`
- Modify: `backend/agents/coordinator.py:1-10`
- Modify: `backend/agents/__init__.py:11`

**Step 1: Create the visual_grounder agent**

Create `backend/agents/visual_grounder.py`:

```python
import os

from google.adk.agents import LlmAgent
from google.adk.tools import BuiltInCodeExecutionTool

visual_grounder = LlmAgent(
    name="visual_grounder",
    model=os.environ.get("GEMINI_FLASH_MODEL", "gemini-3-flash-preview"),
    instruction="""You are a visual grounding specialist for web UI screenshots.

Given a screenshot and action metadata, use code execution to:

1. Identify the interacted element in the screenshot
2. Draw a bounding box around it using PIL or cv2
3. Label the element with its type and visible text
4. If the action is navigation, draw a directional arrow
5. Return the annotated image as a base64 PNG data URL

Use normalized coordinates on a 0-1000 scale relative to image dimensions.
To convert: normalized_x = (pixel_x / image_width) * 1000

Output as structured JSON:
{
  "boundingBox": {"y0": 0, "x0": 0, "y1": 0, "x1": 0},
  "annotatedImageBase64": "data:image/png;base64,...",
  "elementLabel": "Button: Submit Form",
  "spatialRelations": ["above search bar", "inside main form"],
  "confidence": 0.95
}

IMPORTANT: Always output valid JSON. If you cannot identify the element, set confidence to 0 and omit the annotatedImageBase64 field.""",
    output_key="visual_grounding",
    tools=[BuiltInCodeExecutionTool()],
)
```

**Step 2: Add visual_grounder to ParallelAgent**

Replace `backend/agents/coordinator.py` content:

```python
from google.adk.agents import ParallelAgent
from .screenshot_analyzer import screenshot_analyzer
from .description_generator import description_generator
from .decision_detector import decision_detector
from .visual_grounder import visual_grounder

# Process each action with all 4 agents in parallel
root_agent = ParallelAgent(
    name="action_processor",
    sub_agents=[screenshot_analyzer, description_generator, decision_detector, visual_grounder],
)
```

**Step 3: Export visual_grounder in __init__.py**

In `backend/agents/__init__.py`, replace line 11:

```python
__all__ = ["root_agent", "doc_validator", "complex_analyzer"]
```

With:

```python
from .visual_grounder import visual_grounder

__all__ = ["root_agent", "doc_validator", "complex_analyzer", "visual_grounder"]
```

**Step 4: Verify backend loads**

Run: `cd /e/Downloads/agentic-automation/backend && python -c "from agents import root_agent; print(f'Agent: {root_agent.name}, sub_agents: {[a.name for a in root_agent.sub_agents]}')"`
Expected: `Agent: action_processor, sub_agents: ['screenshot_analyzer', 'description_generator', 'decision_detector', 'visual_grounder']`

**Step 5: Commit**

```bash
git add backend/agents/visual_grounder.py backend/agents/coordinator.py backend/agents/__init__.py
git commit -m "feat(backend): add visual_grounder agent with code execution (ROAD-28)

New ParallelAgent sub-agent that draws bounding boxes, annotates
screenshots, and returns normalized coordinates for visual grounding.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Add VisualGrounding type and wire into extension

**Files:**
- Modify: `extension/lib/types.ts` (add VisualGrounding interface + field on CapturedAction)
- Modify: `extension/lib/api/backend-client.ts:170,3-11` (add output key + EnrichedAction field)
- Test: `extension/test/lib/api/backend-client.test.ts`

**Step 1: Write the failing test**

Add this test at the end of the `processActionWithBackend` describe block in `extension/test/lib/api/backend-client.test.ts`:

```typescript
  it('parses visual_grounding from session state (ROAD-28)', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks the Submit button',
      visual_analysis: { elements: [], layout: 'form' },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
      visual_grounding: {
        boundingBox: { y0: 100, x0: 200, y1: 150, x1: 400 },
        annotatedImageBase64: 'data:image/png;base64,annotated',
        elementLabel: 'Button: Submit',
        spatialRelations: ['inside main form'],
        confidence: 0.92,
      },
    });

    const result = await processActionWithBackend(
      createAction({ sessionId: 'sess-grounding' }),
      'data:image/png;base64,abc123',
      BACKEND_URL,
    );

    expect(result).not.toBeNull();
    expect(result!.visualGrounding).toBeDefined();
    expect(result!.visualGrounding!.boundingBox).toEqual({ y0: 100, x0: 200, y1: 150, x1: 400 });
    expect(result!.visualGrounding!.elementLabel).toBe('Button: Submit');
    expect(result!.visualGrounding!.confidence).toBe(0.92);
  });

  it('returns null visualGrounding when visual_grounding is missing from state', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks button',
      visual_analysis: { elements: [], layout: 'form' },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    const result = await processActionWithBackend(createAction(), '', BACKEND_URL);

    expect(result).not.toBeNull();
    expect(result!.visualGrounding).toBeUndefined();
  });
```

**Step 2: Run test to verify it fails**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run test/lib/api/backend-client.test.ts`
Expected: FAIL — `Property 'visualGrounding' does not exist on type 'EnrichedAction'`

**Step 3: Add VisualGrounding interface to types.ts**

In `extension/lib/types.ts`, after the `VisualAnalysis` interface (after line 95), add:

```typescript
export interface VisualGrounding {
  boundingBox?: { y0: number; x0: number; y1: number; x1: number };
  annotatedImageBase64?: string;
  elementLabel?: string;
  spatialRelations?: string[];
  confidence?: number;
}
```

In `CapturedAction` interface, add after the `llmVisualAnalysis` field:

```typescript
  visualGrounding?: VisualGrounding;
```

**Step 4: Update EnrichedAction and processActionWithBackend**

In `extension/lib/api/backend-client.ts`:

Update the import on line 1 to include `VisualGrounding`:

```typescript
import type { CapturedAction, RecordingSession, ValidationResult, VisualAnalysis, VisualGrounding } from '../types';
```

Add `visualGrounding` to `EnrichedAction` (line 3-11):

```typescript
export interface EnrichedAction {
  humanDescription: string;
  visualAnalysis: VisualAnalysis;
  decisionAnalysis: {
    isDecisionPoint: boolean;
    reason: string;
    branches: { condition: string; description: string }[];
  };
  visualGrounding?: VisualGrounding;
}
```

In `processActionWithBackend`, change the polled output keys (line 170) from:

```typescript
      ['description', 'visual_analysis', 'decision_analysis'],
```

To:

```typescript
      ['description', 'visual_analysis', 'decision_analysis'],
```

(Keep the same — `visual_grounding` is optional, we don't want to block on it.)

After line 185 (after `decisionAnalysis` assignment), add:

```typescript
    const visualGrounding = state.visual_grounding
      ? parseJsonSafe<VisualGrounding>(state.visual_grounding)
      : undefined;
```

Update the return on line 187 from:

```typescript
    return { humanDescription: description, visualAnalysis, decisionAnalysis };
```

To:

```typescript
    return { humanDescription: description, visualAnalysis, decisionAnalysis, visualGrounding };
```

**Step 5: Run test to verify it passes**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run test/lib/api/backend-client.test.ts`
Expected: ALL PASS

**Step 6: Run full test suite + type check**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 type errors

**Step 7: Commit**

```bash
git add extension/lib/types.ts extension/lib/api/backend-client.ts extension/test/lib/api/backend-client.test.ts
git commit -m "feat(extension): add VisualGrounding type and wire into backend client (ROAD-28)

New VisualGrounding interface with boundingBox, annotatedImageBase64,
elementLabel, spatialRelations, confidence. Parsed from visual_grounding
output key when present (non-blocking, optional).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Map visual_grounding to CapturedAction in background.ts

**Files:**
- Modify: `extension/entrypoints/background.ts` (enrichment mapping section)

**Step 1: Find the enrichment mapping section**

Search for where `llmVisualAnalysis` is set in `background.ts`. This is where enrichment results from `processActionWithBackend` are mapped onto the action. Add `visualGrounding` mapping right after it.

After the line that sets `llmVisualAnalysis`, add:

```typescript
      if (enrichment.visualGrounding) {
        action.visualGrounding = enrichment.visualGrounding;
      }
```

**Step 2: Run full test suite**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 type errors

**Step 3: Commit**

```bash
git add extension/entrypoints/background.ts
git commit -m "feat(extension): map visualGrounding from enrichment to CapturedAction (ROAD-28)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Use boundingBox as selector fallback in test exporters

**Files:**
- Modify: `extension/lib/export/playwright-exporter.ts`
- Modify: `extension/lib/export/cypress-exporter.ts`
- Modify: `extension/lib/export/selenium-exporter.ts`
- Modify: `extension/lib/export/puppeteer-exporter.ts`

**Context:** Each test exporter generates a locator for click/fill actions. When selectors have low confidence (< 0.5), the exporter currently falls back to generic selectors. With visual grounding, we can fall back to coordinate-based clicks using the bounding box center point.

**Step 1: Read each exporter to find the locator generation pattern**

Read each exporter file to find where CSS/XPath selectors are generated and where low-confidence fallback happens. The pattern will be similar across all 4 exporters.

**Step 2: Add boundingBox coordinate fallback**

For each exporter, after the existing selector cascade, add a final fallback that uses `action.visualGrounding?.boundingBox` if available and confidence >= 0.5:

The specific code depends on each exporter's API:

**Playwright** (`page.click({ position: { x, y } })`):
```typescript
// After selector cascade, if no good selector found:
if (action.visualGrounding?.boundingBox && action.visualGrounding.confidence >= 0.5) {
  const bbox = action.visualGrounding.boundingBox;
  const centerX = Math.round(((bbox.x0 + bbox.x1) / 2) * viewportWidth / 1000);
  const centerY = Math.round(((bbox.y0 + bbox.y1) / 2) * viewportHeight / 1000);
  return `await page.mouse.click(${centerX}, ${centerY});`;
}
```

**Cypress** (`cy.get('body').click(x, y)`):
Similar pattern with Cypress coordinate click API.

**Selenium** (`driver.actions().move({x, y}).click().perform()`):
Similar pattern with Selenium Actions API.

**Puppeteer** (`page.mouse.click(x, y)`):
Similar pattern with Puppeteer mouse API.

**Step 3: Run full test suite**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 type errors

**Step 4: Commit**

```bash
git add extension/lib/export/playwright-exporter.ts extension/lib/export/cypress-exporter.ts extension/lib/export/selenium-exporter.ts extension/lib/export/puppeteer-exporter.ts
git commit -m "feat(extension): add boundingBox coordinate fallback to test exporters (ROAD-28)

When selectors have low confidence and visual grounding is available,
fall back to coordinate-based clicks using bounding box center point.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Use annotated screenshots in HTML/PDF exporters

**Files:**
- Modify: `extension/lib/export/html-exporter.ts`
- Modify: `extension/lib/export/pdf-exporter.ts`

**Step 1: Read each exporter to find where screenshots are rendered**

Find where `action.screenshotDataUrl` is used to embed the screenshot image in the output.

**Step 2: Prefer annotatedImageBase64 when available**

For each exporter, where the screenshot `src` is set, replace:

```typescript
action.screenshotDataUrl
```

With:

```typescript
action.visualGrounding?.annotatedImageBase64 || action.screenshotDataUrl
```

This shows the annotated screenshot (with bounding boxes, labels) when visual grounding ran, and falls back to the raw screenshot otherwise.

**Step 3: Run full test suite**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 type errors

**Step 4: Commit**

```bash
git add extension/lib/export/html-exporter.ts extension/lib/export/pdf-exporter.ts
git commit -m "feat(extension): show annotated screenshots in HTML/PDF exports (ROAD-28)

Prefer visual grounding annotated image (with bounding boxes and labels)
over raw screenshot in HTML and PDF exports when available.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: Temporal Context (Before/After)

### Task 8: Add prevScreenshotDataUrl to backend-client

**Files:**
- Modify: `extension/lib/api/backend-client.ts:117-153`
- Test: `extension/test/lib/api/backend-client.test.ts`

**Step 1: Write the failing test**

Add this test to the `processActionWithBackend` describe block:

```typescript
  it('sends prevScreenshotDataUrl as third inlineData part (ROAD-28)', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks the Next button',
      visual_analysis: { elements: [], layout: 'form', stateChange: 'Button became disabled', actionSucceeded: true },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    const result = await processActionWithBackend(
      createAction({ sessionId: 'sess-temporal' }),
      'data:image/png;base64,afterScreenshot',
      BACKEND_URL,
      undefined,
      'data:image/jpeg;base64,beforeScreenshot',
    );

    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    const body = JSON.parse(postCalls[0][1].body as string);
    expect(body.newMessage.parts).toHaveLength(3);
    expect(body.newMessage.parts[0]).toHaveProperty('text');
    expect(body.newMessage.parts[1]).toEqual({
      inlineData: { mimeType: 'image/png', data: 'afterScreenshot' },
    });
    expect(body.newMessage.parts[2]).toEqual({
      inlineData: { mimeType: 'image/jpeg', data: 'beforeScreenshot' },
    });

    expect(result).not.toBeNull();
    expect(result!.visualAnalysis.stateChange).toBe('Button became disabled');
    expect(result!.visualAnalysis.actionSucceeded).toBe(true);
  });

  it('sends only 2 parts when prevScreenshotDataUrl is undefined', async () => {
    setupFetchMock(fetchMock, {
      description: 'Clicks button',
      visual_analysis: { elements: [], layout: 'form' },
      decision_analysis: { isDecisionPoint: false, reason: '', branches: [] },
    });

    await processActionWithBackend(
      createAction(),
      'data:image/png;base64,abc',
      BACKEND_URL,
      undefined,
      undefined,
    );

    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit?]) => opts?.method === 'POST',
    );
    const body = JSON.parse(postCalls[0][1].body as string);
    expect(body.newMessage.parts).toHaveLength(2);
  });
```

**Step 2: Run test to verify it fails**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run test/lib/api/backend-client.test.ts`
Expected: FAIL — function signature doesn't accept 5th argument

**Step 3: Add prevScreenshotDataUrl parameter**

In `extension/lib/api/backend-client.ts`, modify `processActionWithBackend` signature (line 117-121):

From:
```typescript
export async function processActionWithBackend(
  action: CapturedAction,
  screenshotDataUrl: string,
  backendUrl: string,
  apiKey?: string,
): Promise<EnrichedAction | null> {
```

To:
```typescript
export async function processActionWithBackend(
  action: CapturedAction,
  screenshotDataUrl: string,
  backendUrl: string,
  apiKey?: string,
  prevScreenshotDataUrl?: string,
): Promise<EnrichedAction | null> {
```

Modify the parts construction (line 140, 152-153):

After line 140 (`const screenshotParts = parseScreenshotParts(screenshotDataUrl);`), add:
```typescript
    const prevScreenshotParts = parseScreenshotParts(prevScreenshotDataUrl || '');
```

Change line 153 from:
```typescript
          parts: [textPart, ...screenshotParts],
```
To:
```typescript
          parts: [textPart, ...screenshotParts, ...prevScreenshotParts],
```

**Step 4: Add stateChange and actionSucceeded to VisualAnalysis**

In `extension/lib/types.ts`, add to the `VisualAnalysis` interface (after `codeTrace`):

```typescript
  stateChange?: string;
  actionSucceeded?: boolean | null;
```

**Step 5: Run test to verify it passes**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run test/lib/api/backend-client.test.ts`
Expected: ALL PASS

**Step 6: Run full test suite + type check**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 type errors

**Step 7: Commit**

```bash
git add extension/lib/api/backend-client.ts extension/lib/types.ts extension/test/lib/api/backend-client.test.ts
git commit -m "feat(extension): support prevScreenshotDataUrl for temporal context (ROAD-28)

Add optional prevScreenshotDataUrl parameter to processActionWithBackend.
When provided, sends as 3rd inlineData part for before/after comparison.
Add stateChange and actionSucceeded fields to VisualAnalysis.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Send previous action's screenshot from background.ts

**Files:**
- Modify: `extension/entrypoints/background.ts` (enrichActionInBackground function)

**Step 1: Find enrichActionInBackground and modify**

In the `enrichActionInBackground` function, before the call to `processActionWithBackend`, look up the previous action:

```typescript
    // Look up previous action for temporal context (before/after)
    let prevScreenshotDataUrl: string | undefined;
    if (action.sequenceNumber > 1) {
      const actions = await getSessionActions(action.sessionId);
      const prevAction = actions.find(a => a.sequenceNumber === action.sequenceNumber - 1);
      prevScreenshotDataUrl = prevAction?.screenshotDataUrl;
    }
```

Then pass `prevScreenshotDataUrl` to the `processActionWithBackend` call as the new 5th/6th argument (after `apiKey`).

**Step 2: Run full test suite + type check**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 type errors

**Step 3: Commit**

```bash
git add extension/entrypoints/background.ts
git commit -m "feat(extension): send previous action screenshot for temporal analysis (ROAD-28)

Look up previous action by sequenceNumber in enrichActionInBackground
and pass its screenshotDataUrl to processActionWithBackend for
before/after visual comparison.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Update screenshot_analyzer prompt for before/after comparison

**Files:**
- Modify: `backend/agents/screenshot_analyzer.py`

**Step 1: Update the instruction prompt**

In `backend/agents/screenshot_analyzer.py`, update the instruction to handle 1 or 2 images. Replace the instruction string:

```python
    instruction="""Analyze the screenshot(s) of a web browser tab during a recorded user session.

You may receive ONE or TWO screenshots:
- If TWO images: Image 1 is the page state AFTER the action, Image 2 is BEFORE the action
- If ONE image: It is the page state AFTER the action (no before-state available)

You have code execution available. Use it when beneficial:
- Zoom/crop into small text (input values, tooltips, labels, error messages) for accurate reading
- Draw a bounding box around the interacted element and report normalized coordinates (0-1000 scale)
- Count elements deterministically when multiples are visible
- Compare before/after screenshots to identify visual changes when both are provided

Analyze and extract:
1. All visible UI elements (buttons, inputs, links, text fields)
2. The element that was interacted with — identify it precisely
3. Page context (what section, what application, what workflow)
4. Any visible error messages or status indicators
5. Visual hierarchy and layout information
6. Bounding box of the interacted element (normalized 0-1000 coordinates)
7. [When two images] What visually changed between before and after
8. [When two images] Whether the action appears to have succeeded

Output as structured JSON:
{
  "elements": [{"type": "button|input|link|text|...", "text": "...", "position": "top-left|center|..."}],
  "interactedElement": {"type": "...", "text": "...", "description": "..."},
  "pageContext": {"app": "...", "section": "...", "workflow": "..."},
  "statusIndicators": ["..."],
  "layout": "form|list|dashboard|...",
  "boundingBox": {"y0": 0, "x0": 0, "y1": 0, "x1": 0},
  "codeTrace": "brief summary of code operations performed, or null if none",
  "stateChange": "description of what changed between before and after (omit if only one image)",
  "actionSucceeded": true
}

IMPORTANT: Always output valid JSON. Fields boundingBox, codeTrace, stateChange, and actionSucceeded are optional — include them only when applicable. Never omit the core fields (elements, interactedElement, pageContext, statusIndicators, layout).""",
```

**Step 2: Verify backend loads**

Run: `cd /e/Downloads/agentic-automation/backend && python -c "from agents import root_agent; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/agents/screenshot_analyzer.py
git commit -m "feat(backend): add before/after comparison to screenshot_analyzer prompt (ROAD-28)

Update instruction to handle 1 or 2 screenshots, adding stateChange
and actionSucceeded analysis when before/after pair is available.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Final verification

**Step 1: Run full test suite**

Run: `cd /e/Downloads/agentic-automation/extension && npx vitest run`
Expected: All tests pass (341+ tests)

**Step 2: Type check**

Run: `cd /e/Downloads/agentic-automation/extension && npx tsc --noEmit`
Expected: 0 errors

**Step 3: Verify backend agents load**

Run: `cd /e/Downloads/agentic-automation/backend && python -c "from agents import root_agent, doc_validator, complex_analyzer, visual_grounder; print(f'root: {[a.name for a in root_agent.sub_agents]}'); print(f'standalone: doc_validator, complex_analyzer, visual_grounder')"`
Expected:
```
root: ['screenshot_analyzer', 'description_generator', 'decision_detector', 'visual_grounder']
standalone: doc_validator, complex_analyzer, visual_grounder
```

**Step 4: Verify git log**

Run: `git log --oneline -10`
Expected: 8 new commits, all with `ROAD-28` tag and `Co-Authored-By` trailer

---

## Summary

| Task | Phase | Files | Description |
|---|---|---|---|
| 1 | 1 | 1 | Enable BuiltInCodeExecutionTool on screenshot_analyzer |
| 2 | 1 | 2 | Add boundingBox/codeTrace to VisualAnalysis + test |
| 3 | 2 | 3 | Create visual_grounder agent + wire into ParallelAgent |
| 4 | 2 | 3 | Add VisualGrounding type + wire into backend-client + test |
| 5 | 2 | 1 | Map visualGrounding in background.ts |
| 6 | 2 | 4 | BoundingBox fallback in test exporters |
| 7 | 2 | 2 | Annotated screenshots in HTML/PDF exporters |
| 8 | 3 | 3 | prevScreenshotDataUrl in backend-client + test |
| 9 | 3 | 1 | Send prev screenshot from background.ts |
| 10 | 3 | 1 | Before/after prompt in screenshot_analyzer |
| 11 | — | 0 | Final verification |
