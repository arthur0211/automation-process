# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension that records and documents web processes for humans and LLMs. Two-part architecture:
- **Extension** (All phases complete): Captures user actions, screenshots, video; stores in IndexedDB; exports to JSON/HTML/Playwright; centralized Zustand state; session management; multi-tab recording; video playback; JSON import
- **Backend** (Phase 2D - integrated): Google ADK agents on Vertex AI that enrich recordings with LLM analysis

## Build & Run Commands

### Extension (WXT + Preact + Tailwind 4)
```bash
cd extension
npm install              # install dependencies
npx wxt                  # dev mode (Chrome, hot reload)
npx wxt --browser firefox  # dev mode (Firefox)
npx wxt build            # production build → .output/
npx wxt zip              # create extension ZIP for distribution
```

### Backend (Google ADK + Vertex AI)
```bash
cd backend
pip install -r requirements.txt
adk web                  # local dev server (auto-discovers root_agent from app.py)
adk deploy cloud_run --region us-central1  # deploy to Cloud Run
```

Backend requires Vertex AI env vars — see `backend/.env.example`.

### Tests
```bash
cd extension
npx vitest run           # run all tests (298 tests, vitest + happy-dom + fake-indexeddb)
npx vitest               # watch mode
npx tsc --noEmit         # type check (0 errors expected)
```

### Root shortcuts (forward to extension)
```bash
npm run dev / build / zip
```

## Architecture

### Extension Data Flow
```
Content Script (event listeners) → ACTION_CAPTURED message → Background Service Worker
  → generates description + captures screenshot → stores in IndexedDB (Dexie)
  → broadcasts STATUS_UPDATE → SidePanel UI (Zustand store) renders step list
```

### Extension Message Protocol
Messages flow via `chrome.runtime.sendMessage` between:
- **Content script** (`content.ts`): sends `ACTION_CAPTURED` with element metadata
- **Background** (`background.ts`): orchestrates recording lifecycle, processes actions, manages video capture
- **Popup/SidePanel**: sends `GET_STATUS`, `START_RECORDING`, `STOP_RECORDING`, `PAUSE_RECORDING`
- **Offscreen doc** (`offscreen/main.ts`): handles MediaRecorder for tab video capture

### Backend Agent Pipeline
```
root_agent / action_processor (ParallelAgent)
  ├─ screenshot_analyzer  ($GEMINI_FLASH_MODEL, default gemini-2.0-flash)  → visual_analysis
  ├─ description_generator ($GEMINI_FLASH_MODEL, default gemini-2.0-flash) → description
  └─ decision_detector    ($GEMINI_FLASH_MODEL, default gemini-2.0-flash)  → decision_analysis

Standalone agents (not in pipeline yet):
  ├─ doc_validator      ($GEMINI_PRO_MODEL, default gemini-2.0-pro)        → validation_result
  └─ complex_analyzer   ($CLAUDE_MODEL, default claude-sonnet-4-6)         → complex_analysis
```

`__init__.py` registers Claude in `LLMRegistry` before any agent imports — this order matters.
Model versions are configurable via environment variables (see `backend/.env.example`).

### Extension Key Modules
- `lib/types.ts` — all TypeScript interfaces (`CapturedAction`, `RecordingSession`, `ElementMetadata`, `StatusPayload`, etc.)
- `lib/storage/db.ts` — Dexie IndexedDB with tables: sessions, actions, videoBlobs
- `lib/stores/recording-store.ts` — Zustand vanilla store (single source of truth) + `useRecordingStore` hook via `useSyncExternalStore`
- `lib/stores/recording-actions.ts` — async action creators that sync store mutations to IndexedDB (updateActionWithDb, deleteActionWithDb, reorderActionsWithDb, syncFromBackground, handleStatusUpdate)
- `lib/hooks/use-background-sync.ts` — Preact hook for mount-time sync + STATUS_UPDATE listener (used in App.tsx and Popup.tsx)
- `lib/capture/event-capture.ts` — DOM listeners (click, input, scroll, submit, change, SPA navigation polling)
- `lib/capture/selector-generator.ts` — CSS/XPath selector generation with priority cascade and confidence scoring
- `lib/capture/description-generator.ts` — template-based descriptions (Phase 1; Phase 2D will use LLM)
- `lib/api/backend-client.ts` — ADK backend integration (POST /run + GET session state, configurable URL, error handling)
- `lib/export/json-exporter.ts` — export to ProcessExport JSON schema
- `lib/export/html-exporter.ts` — export to styled self-contained HTML
- `lib/export/playwright-exporter.ts` — export to Playwright .spec.ts test with smart native locator cascade
- `shared/types/process-schema.json` — JSON Schema v7 defining the export format

### Tech Stack
- **Extension**: WXT 0.20, Preact 10, Zustand 5, Dexie 4, Tailwind CSS 4, TypeScript 5.9 (strict)
- **Backend**: Google ADK ≥1.0, Vertex AI, Gemini 3 Flash/Pro, Claude Sonnet 4.6, Python 3.12

## Conventions

- Extension uses **Preact** (not React) — imports from `preact/hooks`, JSX pragma is `react-jsx` via config
- Zustand store uses `zustand/vanilla` + `useSyncExternalStore` from `preact/compat` (not `useStore` from `zustand`, which requires React)
- Action creators with DB side effects live in `recording-actions.ts`, separate from the synchronous store
- ADK agents use `LlmAgent` (not `Agent` which is deprecated) from `google.adk.agents`
- Each agent has an `output_key` that names its output in the pipeline context
- WXT entrypoints follow convention: `entrypoints/<name>/` for UI pages, `entrypoints/<name>.ts` for scripts
- Extension manifest permissions and keyboard shortcuts are defined in `wxt.config.ts`, not a separate manifest.json
- IndexedDB compound index `[sessionId+sequenceNumber]` is used for ordered action queries
- Path alias `@/*` maps to extension root in tsconfig
- Tests use `vitest` + `happy-dom` + `fake-indexeddb`; chrome API mocks via `vi.stubGlobal`

## Project Tracking

- `features.json` — all features with acceptance criteria and status (done/planned)
- `progress.md` — session state, commit history, next steps, known issues, architecture decisions
- Update `progress.md` at the end of each session before `/clear`

## Environment Variables

Backend requires (see `backend/.env.example`):
```
GOOGLE_CLOUD_PROJECT=<project-id>
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=TRUE
```

Extension has no env vars — settings stored in `chrome.storage.local` (screenshot quality, throttle/debounce timers).
