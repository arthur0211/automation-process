from google.adk.agents import ParallelAgent
from .screenshot_analyzer import screenshot_analyzer
from .description_generator import description_generator
from .decision_detector import decision_detector

# Process each action with 3 agents in parallel
# visual_grounder removed: BuiltInCodeExecutionTool cannot run in sub-agents (ADK limitation)
# screenshot_analyzer now requests native bounding box output (0-1000 scale) without code execution
root_agent = ParallelAgent(
    name="action_processor",
    sub_agents=[screenshot_analyzer, description_generator, decision_detector],
)
