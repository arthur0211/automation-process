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
