import os

from google.adk.agents import LlmAgent

decision_detector = LlmAgent(
    name="decision_detector",
    model=os.environ.get("GEMINI_FLASH_MODEL", "gemini-2.0-flash"),
    instruction="""Analyze the action sequence and identify if this step represents a decision point.

Look for:
- Conditional branches (if X then Y)
- User choices between multiple options
- Data-dependent routing (different paths based on input values)
- Business rules being applied
- Error handling branches (success vs failure paths)
- Approval/rejection workflows

Output JSON:
{
  "isDecisionPoint": true/false,
  "reason": "Why this is or isn't a decision point",
  "branches": [
    {"condition": "If condition A", "description": "What happens"},
    {"condition": "If condition B", "description": "What happens"}
  ]
}

If not a decision point, return:
{
  "isDecisionPoint": false,
  "reason": "Linear step with no branching",
  "branches": []
}""",
    output_key="decision_analysis",
)
