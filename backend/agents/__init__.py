from google.adk.models import LLMRegistry
from google.adk.models.anthropic_llm import Claude

# Register Claude models via Vertex AI before any agent imports
LLMRegistry.register(Claude)

from .coordinator import root_agent
from .doc_validator import doc_validator
from .complex_analyzer import complex_analyzer

# visual_grounder kept as standalone file but removed from pipeline
# (BuiltInCodeExecutionTool not supported in ParallelAgent sub-agents)
__all__ = ["root_agent", "doc_validator", "complex_analyzer"]
