"""ADK API server entry point for Agentic Automation backend."""

from agents import coordinator_agent

# ADK will discover this agent and expose it via the API server
# Run locally: adk web
# Deploy: adk deploy cloud_run --region us-central1
agent = coordinator_agent
