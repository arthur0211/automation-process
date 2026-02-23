import os

from google.adk.agents import LlmAgent

screenshot_analyzer = LlmAgent(
    name="screenshot_analyzer",
    model=os.environ.get("GEMINI_FLASH_MODEL", "gemini-2.0-flash"),
    instruction="""Analyze the screenshot and extract:
1. All visible UI elements (buttons, inputs, links, text fields)
2. The element that was interacted with (highlighted or annotated)
3. Page context (what section, what application, what workflow)
4. Any visible error messages or status indicators
5. Visual hierarchy and layout information

Output as structured JSON with the following schema:
{
  "elements": [{"type": "button|input|link|text|...", "text": "...", "position": "top-left|center|..."}],
  "interactedElement": {"type": "...", "text": "...", "description": "..."},
  "pageContext": {"app": "...", "section": "...", "workflow": "..."},
  "statusIndicators": ["..."],
  "layout": "form|list|dashboard|..."
}""",
    output_key="visual_analysis",
)
