"""FastAPI server for ADK agents with health check, API key auth, and env validation."""

import os
import sys

from dotenv import load_dotenv

load_dotenv()  # Load backend/.env before validation

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from google.adk.cli.fast_api import get_fast_api_app

# --- Startup validation ---
_REQUIRED_ENV = ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION"]
_missing = [v for v in _REQUIRED_ENV if not os.environ.get(v)]
if _missing:
    print(f"FATAL: missing required env vars: {', '.join(_missing)}", file=sys.stderr)
    sys.exit(1)

# --- API key from environment (ROAD-13) ---
_API_KEY = os.environ.get("API_KEY")

# --- ADK FastAPI app ---
app: FastAPI = get_fast_api_app(
    agents_dir=os.path.dirname(os.path.abspath(__file__)),
    session_service_uri="sqlite+aiosqlite:///./sessions.db",
    allow_origins=[
        "chrome-extension://*",
        "http://localhost:*",
    ],
    web=False,
)


# --- API key authentication middleware (ROAD-13) ---
class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Check X-API-Key header on all endpoints except /health.

    If the API_KEY environment variable is not set, all requests are allowed (dev mode).
    """

    async def dispatch(self, request: Request, call_next):
        if _API_KEY and request.url.path != "/health":
            provided = request.headers.get("X-API-Key")
            if provided != _API_KEY:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or missing API key"},
                )
        return await call_next(request)


app.add_middleware(ApiKeyMiddleware)


# --- Health check ---
@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})
