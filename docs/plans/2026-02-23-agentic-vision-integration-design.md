# Agentic Vision Integration Design

**Date**: 2026-02-23
**Status**: Approved
**Approach**: Incremental (Phase 1 → 2 → 3)

## Context

Gemini 3 Flash Agentic Vision enables a Think → Act → Observe loop via code execution. The model generates and runs Python code (PIL, cv2, numpy, matplotlib) to manipulate images — zooming, cropping, annotating, drawing bounding boxes — iterating up to 5 times before producing a final answer.

**Key insight**: Agentic Vision is NOT a new model. It is `gemini-3-flash-preview` (already used by our `screenshot_analyzer`) with `BuiltInCodeExecutionTool` + Thinking enabled.

### Capabilities Relevant to This Project

| Capability | Impact |
|---|---|
| Bounding boxes (normalized 0-1000 coords) | Visual grounding of interacted elements → better selectors for test exporters |
| Auto zoom/crop | Read small text in screenshots (labels, inputs, tooltips) |
| Image annotation | Generate annotated screenshots with arrows/boxes for documentation |
| Visual math | Count elements, validate tables, verify form states |
| Audit trail | Executed code + result = verifiable analysis explanation |

### Limitations

- Batch only (not available via Live API)
- ADK: `BuiltInCodeExecutionTool` cannot be mixed with custom function tools per agent
- Max 5 iterations, 30s per code execution step
- Enabling code execution may cause regressions in structured output
- Model status: `gemini-3-flash-preview` is Public Preview (not GA)

## Phase 1 — Drop-in Enhancement on screenshot_analyzer

**Goal**: Activate code execution on the existing agent. Zero extension changes.

### Changes

**`backend/agents/screenshot_analyzer.py`** (edit):
- Add `from google.adk.tools import BuiltInCodeExecutionTool`
- Add `tools=[BuiltInCodeExecutionTool()]` to `LlmAgent`
- Update instruction prompt to leverage zoom/crop/annotation when useful
- Maintain same JSON output schema (backward compatible)
- Add optional fields: `boundingBox` (normalized 0-1000), `codeTrace`

**`extension/lib/types.ts`** (edit):
- Add to `VisualAnalysis` interface:
  - `boundingBox?: { y0: number; x0: number; y1: number; x1: number }`
  - `codeTrace?: string`

### Validation

- Test with 10+ real screenshots before merge
- Compare output quality with/without code execution
- Verify JSON schema compliance is maintained
- If regression detected, rollback = remove `tools=` line

### Effort: XS (half day)

---

## Phase 2 — Visual Grounding Agent

**Goal**: Dedicated agent for bounding box extraction and screenshot annotation.

### New Files

**`backend/agents/visual_grounder.py`** (new):
```python
import os
from google.adk.agents import LlmAgent
from google.adk.tools import BuiltInCodeExecutionTool

visual_grounder = LlmAgent(
    name="visual_grounder",
    model=os.environ.get("GEMINI_FLASH_MODEL", "gemini-3-flash-preview"),
    instruction="""You are a visual grounding specialist. Given a screenshot and action metadata:

1. Draw a bounding box around the interacted element using PIL/cv2
2. Label the element with its type and text
3. Draw directional arrows if the action involves navigation
4. Return normalized coordinates (0-1000 scale) and the annotated image as base64 PNG

Output JSON:
{
  "boundingBox": {"y0": N, "x0": N, "y1": N, "x1": N},
  "annotatedImageBase64": "data:image/png;base64,...",
  "elementLabel": "Button: Submit Form",
  "spatialRelations": ["above search bar", "inside main form"],
  "confidence": 0.95
}""",
    output_key="visual_grounding",
    tools=[BuiltInCodeExecutionTool()],
)
```

### Modified Files

**`backend/agents/coordinator.py`** (edit):
- Import `visual_grounder`
- Add to `ParallelAgent` sub_agents list

**`backend/agents/__init__.py`** (edit):
- Import and export `visual_grounder`

**`extension/lib/types.ts`** (edit):
- New `VisualGrounding` interface
- Add `visualGrounding?: VisualGrounding` to `CapturedAction`

**`extension/lib/api/backend-client.ts`** (edit):
- Add `'visual_grounding'` to polled output keys
- Map result to `EnrichedAction`

**`extension/entrypoints/background.ts`** (edit):
- Map `visual_grounding` response to `action.visualGrounding`

**Test exporters** (Playwright, Cypress, Selenium, Puppeteer) (edit):
- Use `boundingBox` as click coordinate fallback when selectors have low confidence
- Example: `await page.click({ position: { x: bbox.x0 * width / 1000, y: bbox.y0 * height / 1000 } })`

**HTML/PDF exporters** (edit):
- Use `annotatedImageBase64` when available instead of raw screenshot

### Effort: M (2-3 days)

---

## Phase 3 — Temporal Context (Before/After Screenshots)

**Goal**: Send previous action's screenshot as "before" state for transition analysis.

### Changes

**`extension/entrypoints/background.ts`** (edit):
- In `enrichActionInBackground`, look up previous action via `getSessionActions(sessionId)`
- Pass `prevAction.screenshotDataUrl` to backend client

**`extension/lib/api/backend-client.ts`** (edit):
- Add optional `prevScreenshotDataUrl?: string` parameter to `processActionWithBackend`
- Send as additional `inlineData` part when present

**`backend/agents/screenshot_analyzer.py`** (edit):
- Update prompt: when 2 images provided, first is BEFORE, second is AFTER
- Add analysis of what changed and whether action succeeded

**`extension/lib/types.ts`** (edit):
- Add to `VisualAnalysis`:
  - `stateChange?: string`
  - `actionSucceeded?: boolean | null`

### Data Flow

```
enrichActionInBackground(action)
  ├─ getSessionActions(sessionId)
  │    └─ find action with sequenceNumber === action.sequenceNumber - 1
  │         → prevAction.screenshotDataUrl (the "before" screenshot)
  └─ processActionWithBackend(action, screenshot, prevScreenshot, ...)
       └─ ADK message parts:
            [0] JSON text (action metadata)
            [1] inlineData: post-action screenshot (existing)
            [2] inlineData: pre-action screenshot (NEW, omitted if absent)
```

### Effort: S (1-2 days)

---

## Complete File Change Matrix

| Phase | File | Change Type |
|---|---|---|
| 1 | `backend/agents/screenshot_analyzer.py` | Edit (add tool + prompt) |
| 1 | `extension/lib/types.ts` | Edit (2 optional fields in VisualAnalysis) |
| 2 | `backend/agents/visual_grounder.py` | **New** |
| 2 | `backend/agents/coordinator.py` | Edit (add sub-agent) |
| 2 | `backend/agents/__init__.py` | Edit (export) |
| 2 | `extension/lib/types.ts` | Edit (VisualGrounding interface) |
| 2 | `extension/lib/api/backend-client.ts` | Edit (new output key) |
| 2 | `extension/entrypoints/background.ts` | Edit (map grounding) |
| 2 | `extension/lib/export/playwright-exporter.ts` | Edit (bbox fallback) |
| 2 | `extension/lib/export/cypress-exporter.ts` | Edit (bbox fallback) |
| 2 | `extension/lib/export/selenium-exporter.ts` | Edit (bbox fallback) |
| 2 | `extension/lib/export/puppeteer-exporter.ts` | Edit (bbox fallback) |
| 2 | `extension/lib/export/html-exporter.ts` | Edit (annotated screenshot) |
| 2 | `extension/lib/export/pdf-exporter.ts` | Edit (annotated screenshot) |
| 3 | `extension/entrypoints/background.ts` | Edit (prev screenshot) |
| 3 | `extension/lib/api/backend-client.ts` | Edit (3rd inlineData part) |
| 3 | `backend/agents/screenshot_analyzer.py` | Edit (before/after prompt) |
| 3 | `extension/lib/types.ts` | Edit (stateChange, actionSucceeded) |

## Pricing Impact

| Phase | Cost per Action (approx) | Reason |
|---|---|---|
| Current | ~$0.001 | 1 image × 3 agents (Flash) |
| Phase 1 | ~$0.002-0.005 | Code execution tokens (intermediate code = input tokens) |
| Phase 2 | ~$0.003-0.007 | +1 agent with code execution |
| Phase 3 | ~$0.005-0.010 | 2 images × agents with code execution |

All pricing based on Gemini Flash ($0.50/1M input, $3.00/1M output tokens).

## Sources

- [Agentic Vision Blog Post](https://blog.google/innovation-and-ai/technology/developers-tools/agentic-vision-gemini-3-flash/)
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Code Execution API Docs](https://ai.google.dev/gemini-api/docs/code-execution)
- [ADK Gemini Models Docs](https://google.github.io/adk-docs/agents/models/google-gemini/)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
