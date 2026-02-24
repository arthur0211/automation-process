import os

from google.adk.agents import LlmAgent
from google.adk.tools import BuiltInCodeExecutionTool

screenshot_analyzer = LlmAgent(
    name="screenshot_analyzer",
    model=os.environ.get("GEMINI_FLASH_MODEL", "gemini-3-flash-preview"),
    instruction="""Analyze the screenshot(s) of a web browser tab during a recorded user session.

You may receive ONE or TWO screenshots:
- If TWO images: Image 1 is the page state AFTER the user action, Image 2 is BEFORE the action
- If ONE image: It is the page state AFTER the user action (no before-state available)

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
    output_key="visual_analysis",
    tools=[BuiltInCodeExecutionTool()],
)
