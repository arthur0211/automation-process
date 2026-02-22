# Agentic Automation Recorder

Chrome Extension that records web interactions and exports process documentation for humans (HTML) and LLMs (JSON).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                           │
│                                                                 │
│  ┌──────────────┐    ACTION_CAPTURED    ┌────────────────────┐  │
│  │Content Script ├─────────────────────►│ Background Service │  │
│  │(event capture)│                      │ Worker             │  │
│  └──────────────┘                      │  • description gen │  │
│                                         │  • screenshot cap  │  │
│  ┌──────────────┐    STATUS_UPDATE      │  • video capture   │  │
│  │  Side Panel   │◄────────────────────┤  • IndexedDB store │  │
│  │  (Preact UI)  │                      └────────┬───────────┘  │
│  │  • step list  │                               │              │
│  │  • controls   │                      ┌────────▼───────────┐  │
│  │  • export     │                      │    IndexedDB       │  │
│  └──────────────┘                      │  (Dexie)           │  │
│                                         │  • sessions        │  │
│  ┌──────────────┐                      │  • actions         │  │
│  │   Offscreen   │                      │  • videoBlobs      │  │
│  │(MediaRecorder)│                      └────────────────────┘  │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Export ────┤
                              │
              ┌───────────────┼───────────────┬────────────────┐
              ▼               ▼               ▼                ▼
      ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
      │  JSON Export  │ │  HTML Export  │ │ Playwright Test│
      │  (for LLMs)  │ │ (for humans)  │ │  (.spec.ts)    │
      └──────────────┘ └──────────────┘ └────────────────┘
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Extension** | WXT 0.20, Preact 10, Zustand 5, Dexie 4, Tailwind CSS 4, TypeScript 5.9 |
| **Backend** (Phase 2D) | Google ADK, Vertex AI, Gemini 3 Flash/Pro, Claude Sonnet 4.6, Python 3.12 |
| **Tests** | Vitest, happy-dom, fake-indexeddb |

## Setup & Run

### Extension

```bash
cd extension
npm install              # install dependencies
npx wxt                  # dev mode (Chrome, hot reload)
npx wxt --browser firefox  # dev mode (Firefox)
npx wxt build            # production build → .output/
npx wxt zip              # create extension ZIP
npx vitest run           # run 116 tests
npx tsc --noEmit         # type check (0 errors)
```

Or from root:

```bash
npm run dev    # forwards to extension dev
npm run build  # forwards to extension build
npm run zip    # forwards to extension zip
```

### Backend (Phase 2)

```bash
cd backend
pip install -r requirements.txt
adk web                  # local dev server
```

Requires Vertex AI environment variables — copy `backend/.env.example` to `backend/.env` and fill in your project ID.

## How to Use

1. **Install** — Load the unpacked extension from `extension/.output/chrome-mv3/` in `chrome://extensions` (enable Developer Mode)
2. **Start Recording** — Click the extension popup and press **Start Recording**, or use `Ctrl+Shift+R`
3. **Interact** — Browse normally. The extension captures clicks, inputs, scrolls, form submissions, and navigation
4. **Review** — Open the Side Panel to see captured steps with screenshots and descriptions
5. **Edit** — Edit descriptions, add notes, reorder or delete steps in the Side Panel
6. **Export** — Download as JSON (for LLMs), HTML (self-contained report), or Playwright test (.spec.ts)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Start recording |
| `Ctrl+Shift+P` | Pause / Resume recording |
| `Ctrl+Shift+S` | Stop recording |

## Export Formats

- **JSON** — Structured export following JSON Schema v1.0.0 (`shared/types/process-schema.json`). Designed for LLM ingestion and programmatic processing
- **HTML** — Self-contained styled report with embedded screenshots. Human-readable documentation of the recorded process
- **Playwright** — Executable `.spec.ts` test file with smart native locator cascade (getByTestId > getByRole > getByLabel > getByPlaceholder > CSS). Includes confidence scores as comments

## Project Status

- **Phase 1** (Extension core) — Complete. Recording, capture, storage, JSON/HTML export
- **Phase 2A** (Bugfixes + quick wins) — Complete. 7 bugfixes + 4 enhancements
- **Phase 2B** (Playwright exporter) — Complete. Smart locator cascade, 17 tests
- **Phase 2C** (Zustand migration) — Complete. Centralized state, eliminated duplicated local state
- **Phase 2D** (Backend integration) — Planned. LLM-powered enrichment via Google ADK agents on Vertex AI

See `features.json` for the full feature inventory and `progress.md` for current session state.
