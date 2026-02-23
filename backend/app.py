"""ADK API server entry point for Agentic Automation backend."""

from agents import root_agent

# ADK will discover this agent and expose it via the API server
# Run locally: adk web
# Deploy: adk deploy cloud_run --region us-central1
agent = root_agent
