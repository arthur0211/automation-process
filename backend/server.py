"""FastAPI server for ADK agents with health check and env validation."""

import os
import sys

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from google.adk.cli.fast_api import get_fast_api_app

# --- Startup validation ---
_REQUIRED_ENV = ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION"]
_missing = [v for v in _REQUIRED_ENV if not os.environ.get(v)]
if _missing:
    print(f"FATAL: missing required env vars: {', '.join(_missing)}", file=sys.stderr)
    sys.exit(1)

# --- ADK FastAPI app ---
app: FastAPI = get_fast_api_app(
    agents_dir=os.path.dirname(os.path.abspath(__file__)),
    session_service_uri="sqlite+aiosqlite:///./sessions.db",
    allow_origins=["*"],
    web=False,
)


# --- Health check ---
@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})
