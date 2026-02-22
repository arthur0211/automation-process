# Progress

## Current State

- **Latest commit**: `chore: add features.json with complete project feature tracking`
- **Total commits**: 6
- **Tests**: 116 passing (extension)
- **TS errors**: 0
- **Extension**: Feature-complete for Phase 1 + 2A + 2B + 2C
- **Backend**: ADK agents defined (7 agents), not yet integrated with extension

## Completed This Session

### Phase 2C: Zustand Store Migration
- Created centralized `recordingStore` with `zustand/vanilla` + `useSyncExternalStore` (Preact compat)
- Created `recording-actions.ts` with DB-synced action creators (update, delete, reorder, sync)
- Created `useBackgroundSync` hook replacing 3 duplicated STATUS_UPDATE listeners
- Refactored App.tsx, RecordingControls.tsx, Popup.tsx to use store
- Eliminated ~60 lines of duplicated local state
- Added 19 new tests (13 store + 6 action creators)

### Maintenance
- Fixed 3 pre-existing TS strict-mode errors (background.ts spread type, selector-generator circular inference)
- Created features.json with 38 features (27 done, 12 planned)
- Created this progress.md

## Commit History

1. `feat: initial project setup` — Project scaffolding, extension + backend structure
2. `fix(extension): phase 2A — 7 bugfixes + 4 quick wins` — Settings wiring, race conditions, password masking, push status, reorder persist, unified listener, SW persistence, data-testid, change events, confidence scoring, delete step
3. `feat(extension): add Playwright test exporter with native locators` — Playwright .spec.ts exporter with smart locator cascade, 17 tests
4. `refactor(extension): migrate UI state to Zustand store` — Zustand store as single source of truth, action creators with DB sync, useBackgroundSync hook
5. `fix(extension): resolve pre-existing TypeScript strict-mode errors` — Cast stored.settings, fix circular inference in selector-generator
6. `chore: add features.json with complete project feature tracking` — 38 features with acceptance criteria and status

## Next Steps

### Phase 2D: Backend Integration (next priority)
1. **P2D-01**: Implement `backend-client.ts` — connect to ADK backend API
2. **P2D-02**: Add backend URL configuration to Options page
3. **P2D-03**: Wire `processActionWithBackend` into background.ts processAction pipeline
4. **P2D-04**: Populate `llmDescription` and `llmVisualAnalysis` from agent responses
5. **P2D-05**: Integrate decision_detector results into DecisionPoint
6. **P2D-06**: Add doc_validator to export/review flow
7. **P2D-07**: Add complex_analyzer for low-confidence actions

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
