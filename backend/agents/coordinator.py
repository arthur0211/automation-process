from google.adk.agents import ParallelAgent, SequentialAgent
from .screenshot_analyzer import screenshot_analyzer
from .description_generator import description_generator
from .decision_detector import decision_detector

# Process each action with all 3 agents in parallel
action_processor = ParallelAgent(
    name="action_processor",
    sub_agents=[screenshot_analyzer, description_generator, decision_detector],
)

# Main pipeline: parallel processing of each action
coordinator_agent = SequentialAgent(
    name="recording_pipeline",
    sub_agents=[action_processor],
)
