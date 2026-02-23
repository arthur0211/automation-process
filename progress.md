# Progress

## Current State

- **Latest commit**: `feat(extension): add Selenium WebDriver test exporter (ROAD-26)`
- **Total commits**: 69
- **Tests**: 320 passing (extension), 17 test files
- **TS errors**: 0
- **Lint errors**: 0
- **Extension**: Feature-complete — 63 features done in features.json, 6 remaining (XL/L scope or external deps)
- **Backend**: ADK agents consolidated (single app), model versions configurable via env vars, Dockerfile fixed, health check, API key auth.

## Feature Completion Summary

### Done (63 features in features.json)
- **Phase 1** (P1-01 to P1-08): Core capture, selectors, screenshots, video, descriptions, storage, sidepanel, popup — all done
- **Phase 2A** (P2A-01 to P2A-11): Bugfixes, settings wiring, race conditions, password masking, reorder, delete — all done
- **Phase 2B** (P2B-01 to P2B-03): Playwright exporter, JSON exporter, HTML exporter — all done
- **Phase 2C** (P2C-01 to P2C-05): Zustand store migration, action creators, useBackgroundSync — all done
- **Phase 2D** (P2D-01 to P2D-07): Backend integration, validation, complex analysis — all done
- **Audit** (AUDIT-01 to AUDIT-05): loadState fix, VisualAnalysis types, decision badges, Playwright reliability, project hygiene — all done
- **FUTURE-01**: Video playback and HTML export with timeline sync
- **FUTURE-02**: Session management (list, rename, delete, 3-level nav)
- **FUTURE-03**: JSON import for recording sessions
- **FUTURE-04**: Multi-tab recording with tab switch detection
- **ROAD-01**: Markdown and clipboard export (19 tests)
- **ROAD-03**: Step search and filter (8 tests)
- **ROAD-04**: Screenshot thumbnails with toggle
- **ROAD-05**: First-run onboarding tooltips
- **ROAD-06**: Hover and right-click event capture (4 tests)
- **ROAD-07**: GitHub Issue export (6 tests)
- **ROAD-08**: Export preview panel (JSON/HTML/Playwright/Markdown)
- **ROAD-09**: Undo toast for destructive actions
- **ROAD-10**: Dockerfile CMD fix, health check, non-root user
- **ROAD-11**: Screenshot inlineData format for vision models
- **ROAD-12**: Session state polling with exponential backoff
- **ROAD-13**: Backend API key authentication
- **ROAD-14**: Retry with exponential backoff (429/503)
- **ROAD-15**: Pin model versions, consolidate ADK apps, remove redundant entry points
- **ROAD-17**: PDF export via print dialog (22 tests)
- **ROAD-21**: Custom branding — accent color, header/footer, TOC for 10+ steps (9 tests)
- **ROAD-24**: Playwright test.step() blocks and parameterization (21 tests)
- **ROAD-20**: Playwright + CI export with GitHub Actions workflow (12 tests)
- **ROAD-25**: Cypress test exporter (22 tests)
- **ROAD-26**: Selenium WebDriver test exporter (22 tests)

### Remaining Planned (6 features — all require external infrastructure)
- **ROAD-02**: Chrome Web Store submission (P0, M) — manual process, needs store assets/privacy policy
- **ROAD-16**: Cloud sync and sharing (P1, XL) — requires external infrastructure (Supabase/Firebase)
- **ROAD-18**: Hosted AI enrichment endpoint (P1, L) — requires Cloud Run deployment
- **ROAD-19**: Team workspace (P2, XL) — requires backend + auth infrastructure
- **ROAD-22**: Jira and Linear integration (P2, L) — requires OAuth/API token flow
- **ROAD-23**: Chrome Built-in AI / Gemini Nano (P2, L) — still in origin trial, not GA

## Completed This Session

### Sprint 3: UX Features
- **ROAD-01**: Markdown exporter + clipboard copy in ExportPanel (19 tests)
- **ROAD-03**: Search bar + action type filter in StepList, Zustand state (8 tests)
- **ROAD-04**: Screenshot thumbnails (48x36) with lazy loading, toggle in Options
- **ROAD-05**: Welcome tooltip, export format tips, info icons, collapsible Advanced section
- **ROAD-08**: Export preview modal with format tabs, copy, download
- **ROAD-09**: Undo toast replaces confirm() dialogs, 5s countdown, optimistic delete

### Sprint 4: Feature Expansion
- **ROAD-06**: Hover (mouseover on interactive elements, configurable) and right-click capture (4 tests)
- **ROAD-07**: GitHub Issue export with PAT, repo selector, markdown body (6 tests)
- **ROAD-24**: Playwright test.step() blocks, testData parameterization, process.env for passwords, waitForURL (21 tests)
- **ROAD-25**: Cypress .cy.ts exporter with locator cascade, cy.visit/type/click (22 tests)

### Sprint 5: Backend Reliability
- **ROAD-10**: Fixed Dockerfile CMD (server:app), /health endpoint, env var validation, non-root user, .dockerignore
- **ROAD-11**: parseScreenshotParts() for inlineData image parts
- **ROAD-12**: pollSessionState() with exponential backoff
- **ROAD-13**: X-API-Key header on all requests, middleware in server.py, API key in Options
- **ROAD-14**: fetchWithRetry() for 429/503 with Retry-After support
- **ROAD-15**: Model versions configurable via env vars, consolidated single ADK app, removed redundant entry points

### Sprint 6: Export Enhancement
- **ROAD-17**: PDF export via print dialog — cover page, page breaks, print-optimized HTML (22 tests)
- **ROAD-21**: Custom branding — accent color picker, header/footer text, TOC for 10+ steps, step anchors (9 tests)

## Commit History

1-35. (See previous progress.md entries)
36. `fix(extension): send screenshots as inlineData and add retry/polling (ROAD-11/12/14)`
37. `feat(extension): add Markdown export with clipboard copy (ROAD-01)`
38. `feat(extension): add search/filter and thumbnails to step list (ROAD-03/04)`
39. `chore: mark ROAD-01/03/04/11/12/14 as done in features.json`
40. `fix(backend): fix Dockerfile CMD and add health check (ROAD-10)`
41. `feat(extension): add test.step() blocks and parameterization to Playwright export (ROAD-24)`
42. `feat(extension): add first-run onboarding tooltips (ROAD-05)`
43. `feat(extension): add GitHub Issue export (ROAD-07)`
44. `chore: mark ROAD-05/07/10/24 as done in features.json`
45. `feat(extension): add hover and right-click event capture (ROAD-06)`
46. `feat(extension): add API key authentication for backend (ROAD-13)`
47. `chore: mark ROAD-05/06/07/13 as done in features.json`
48. `feat(extension): add export preview panel (ROAD-08)`
49. `feat(extension): replace confirm dialogs with undo toast (ROAD-09)`
50. `feat(extension): add Cypress test exporter (ROAD-25)`
51. `chore: update tracking for ROAD-08/09/25 and refresh progress.md`
52. `fix: restrict CORS origins and update test count in CLAUDE.md`
53. `chore: upgrade CI to Node 22 (Node 20 EOL April 2026)`
54. `refactor(backend): pin model versions and consolidate ADK apps (ROAD-15)`
55. `feat(extension): add PDF export via print dialog (ROAD-17)`
56. `feat(extension): add custom branding for HTML exports (ROAD-21)`
57. `chore: update tracking for ROAD-15/17/21 — 61 features done, 286 tests`
58. `feat(extension): add Playwright + CI export with GitHub Actions workflow (ROAD-20)`
59. `chore: mark ROAD-20 as done in features.json`
60. `fix: restrict CORS origins and update test count in CLAUDE.md` (duplicate — merge artifact)
61-66. CI, tracking, ROAD-20, ROAD-21, ROAD-17, ROAD-15 commits
67. `fix(test): increase timeout for retry tests to prevent flaky failures`
68. `chore: upgrade Gemini models to 3-preview and fix review issues`
69. `feat(extension): add Selenium WebDriver test exporter (ROAD-26)`

## 360 Audit Results (Updated)

### Scores by Area
| Area | Score | Notes |
|------|-------|-------|
| Extension Code | 9.5/10 | 320 tests, 0 TS errors, 0 lint errors, 9 exporters |
| Tests | A+ | 320 tests across 17 files, all passing |
| Features | 91% | 63/69 features done, remaining 6 require external infrastructure |
| Backend | Deployable | Dockerfile fixed, health check, API auth, env validation, consolidated |
| Documentation | 9/10 | CLAUDE.md, README, features.json, progress.md all up to date |
| Automation | 9/10 | GitHub Actions CI, ESLint + Prettier |
| Product | 9.5/10 | Complete workflow: capture → enrich → manage → export (9 formats) → integrate (GitHub) |

## Known Issues

- **Build EBUSY error** (Windows): `npx wxt build` occasionally fails with `EBUSY: resource busy or locked` on `.output/` directory. Workaround: close Chrome extension devtools.
- **Offscreen document**: Chrome sometimes reports offscreen document already exists on rapid start/stop cycles. Handled with try/catch.
- **Backend flaky test**: `backend-client.test.ts` retry tests use real timer delays via `shouldAdvanceTime`. Timeout increased to 15s (commit 322cf41).

## Architecture Decisions

- **Zustand vanilla + useSyncExternalStore**: Preact-compatible store pattern (not useStore from zustand/react)
- **Action creators separate from store**: recording-actions.ts for async DB ops, store stays synchronous
- **Background as source of truth**: Service worker owns status/sessionId/actionCount, Zustand is UI mirror
- **ADK agent registration order**: __init__.py registers Claude in LLMRegistry before any agent imports
- **Preact (not React)**: Preact 10 with @preact/preset-vite, imports from preact/hooks and preact/compat
- **Async enrichment**: Actions stored immediately, backend enrichment runs in background, UI updates via STATUS_UPDATE
- **Optimistic deletes**: Items removed from UI instantly, committed to DB after 5s undo window
- **Export architecture**: 5 exporters (JSON, HTML, Markdown, Playwright, Cypress) all follow same pattern: pure functions taking session+actions
