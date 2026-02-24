from google.adk.models import LLMRegistry
from google.adk.models.anthropic_llm import Claude

# Register Claude models via Vertex AI before any agent imports
LLMRegistry.register(Claude)

from .coordinator import root_agent
from .doc_validator import doc_validator
from .complex_analyzer import complex_analyzer
from .visual_grounder import visual_grounder

__all__ = ["root_agent", "doc_validator", "complex_analyzer", "visual_grounder"]
