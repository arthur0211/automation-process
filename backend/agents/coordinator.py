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
