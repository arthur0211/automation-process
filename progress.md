# Progress

## Current State

- **Latest commit**: `feat(extension): integrate ADK backend for async action enrichment`
- **Total commits**: 9
- **Tests**: 122 passing (extension)
- **TS errors**: 0
- **Extension**: Feature-complete for Phase 1 + 2A + 2B + 2C + 2D (pipeline)
- **Backend**: ADK agents defined (7 agents), extension integration complete for pipeline (P2D-01 to P2D-05)

## Completed This Session

### Phase 2D: Backend Integration (Pipeline)
- Rewrote `backend-client.ts` with real ADK API integration (POST /run + GET session state)
- Added async enrichment in `background.ts` — actions stored immediately, enriched in background
- Added Backend URL configuration to Options page (stored in `chrome.storage.local`)
- Added AI Description, Visual Analysis, and Decision branches display in StepDetail
- 6 new tests for backend-client (empty URL, ADK format, network error, 500, session GET fail, JSON string parsing)

### Previous Sessions
- Phase 2C: Zustand Store Migration (centralized store, action creators, useBackgroundSync)
- Maintenance: Fixed TS errors, created features.json + progress.md, updated README + CLAUDE.md

## Commit History

1. `feat: initial project setup` — Project scaffolding, extension + backend structure
2. `fix(extension): phase 2A — 7 bugfixes + 4 quick wins` — Settings wiring, race conditions, password masking, push status, reorder persist, unified listener, SW persistence, data-testid, change events, confidence scoring, delete step
3. `feat(extension): add Playwright test exporter with native locators` — Playwright .spec.ts exporter with smart locator cascade, 17 tests
4. `refactor(extension): migrate UI state to Zustand store` — Zustand store as single source of truth, action creators with DB sync, useBackgroundSync hook
5. `fix(extension): resolve pre-existing TypeScript strict-mode errors` — Cast stored.settings, fix circular inference in selector-generator
6. `chore: add features.json with complete project feature tracking` — 38 features with acceptance criteria and status
7. `docs: update README and CLAUDE.md with current architecture` — Playwright in diagram, tests in tech stack, project status
8. `feat(extension): integrate ADK backend for async action enrichment` — backend-client, Options URL, StepDetail enriched display, 6 tests

## Next Steps

### Phase 2D: Remaining (standalone agents)
1. **P2D-06**: Add doc_validator to export/review flow
2. **P2D-07**: Add complex_analyzer for low-confidence actions

### Future Backlog
- FUTURE-01: Video playback/export in HTML report
- FUTURE-02: Session management (list, rename, delete)
- FUTURE-03: Import recordings from JSON
- FUTURE-04: Multi-tab recording
- FUTURE-05: Cloud sync / sharing

## Known Issues

- **Build EBUSY error** (Windows): `npx wxt build` occasionally fails with `EBUSY: resource busy or locked` on `.output/` directory. Workaround: close Chrome extension devtools or file explorers pointing at `.output/`, retry build.
- **Offscreen document**: Chrome sometimes reports offscreen document already exists on rapid start/stop cycles. Handled with try/catch in `ensureOffscreen()`.
- **LF/CRLF warnings**: Git warns about line ending conversions on Windows. Not a blocker, may benefit from `.gitattributes` configuration.

## Architecture Decisions

- **Zustand vanilla + useSyncExternalStore**: Chosen over `useStore` from `zustand` because the project uses Preact (not React). `zustand/vanilla` with `useSyncExternalStore` from `preact/compat` avoids needing React as a dependency.
- **Action creators separate from store**: `recording-actions.ts` contains async DB-synced operations, keeping the store itself synchronous and testable.
- **Background as source of truth for recording state**: The background service worker owns `status`, `sessionId`, `actionCount`. The Zustand store is a UI mirror synced via `useBackgroundSync`.
- **ADK agent registration order**: `backend/agents/__init__.py` must register Claude in `LLMRegistry` before any agent imports to avoid model resolution errors.
- **Preact (not React)**: Extension uses Preact 10 with `@preact/preset-vite` for JSX. Imports from `preact/hooks`, `preact/compat`. WXT bundles handle the alias for build, but test environment needs explicit Preact-only imports.
- **Async enrichment (Phase 2D)**: Actions are stored immediately in IndexedDB with template descriptions. Backend enrichment runs asynchronously in the background service worker. When results arrive, the action is updated in DB and `broadcastStatus()` triggers UI refresh via the existing `handleStatusUpdate` → `syncFromBackground` path.
- **ADK API format**: POST /run uses camelCase fields (`appName`, `userId`, `sessionId`, `newMessage`). Output keys (`description`, `visual_analysis`, `decision_analysis`) are read from session state via GET endpoint, which is more robust than parsing /run response events.
- **Session reuse**: Extension's `sessionId` is reused as ADK `sessionId`, giving the agent pipeline context of previous actions in the same recording session.
