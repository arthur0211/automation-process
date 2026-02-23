import os

from google.adk.agents import LlmAgent

doc_validator = LlmAgent(
    name="doc_validator",
    model=os.environ.get("GEMINI_PRO_MODEL", "gemini-2.0-pro"),
    instruction="""Validate the completeness and quality of a recorded process documentation.

Check for:
1. Completeness: Are all steps captured? Any missing intermediate steps?
2. Clarity: Are descriptions clear and unambiguous?
3. Accuracy: Do descriptions match the screenshots?
4. Decision Points: Are all branches properly identified?
5. Business Logic: Is the business process flow logical?
6. Reproducibility: Could someone follow this documentation to reproduce the process?

Output JSON:
{
  "overallScore": 1-10,
  "issues": [
    {"step": 3, "type": "missing_step|unclear|inaccurate|missing_decision", "description": "..."},
  ],
  "suggestions": [
    {"step": 3, "suggestion": "..."},
  ],
  "missingSteps": [
    {"afterStep": 2, "description": "A step to verify the email address seems to be missing"}
  ],
  "summary": "Overall assessment of the documentation quality"
}""",
    output_key="validation_result",
)
