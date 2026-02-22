from google.adk.models import LLMRegistry
from google.adk.models.anthropic_llm import Claude

# Register Claude models via Vertex AI before any agent imports
LLMRegistry.register(Claude)

from .coordinator import coordinator_agent
from .doc_validator import doc_validator
from .complex_analyzer import complex_analyzer

__all__ = ["coordinator_agent", "doc_validator", "complex_analyzer"]
