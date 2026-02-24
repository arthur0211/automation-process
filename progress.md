# Progress

## Current State

- **Latest commit**: `feat(extension,backend): add Gemini BYOK direct API + EnrichmentProvider architecture`
- **Total commits**: 88
- **Tests**: 349 passing (extension), 18 test files
- **TS errors**: 0
- **Lint errors**: 0
- **Extension**: 71 features done, 6 planned (external deps), 5 UX refinements remaining (Sprint Refine-2)
- **Backend**: 3-agent pipeline (removed broken BuiltInCodeExecutionTool + visual_grounder). Dotenv auto-loading.
- **AI Enrichment**: 3-tier model: Tier 0 (no AI), Tier 1 (Gemini BYOK direct), Tier 2 (ADK backend Vertex AI)
- **Architecture**: EnrichmentProvider interface unifies both paths. GeminiDirectProvider + AdkBackendProvider.
- **UX Testing**: Comprehensive E2E testing via Playwright MCP completed (2026-02-24). 23 UX issues documented, 2 bugs found, 3 Agent Team reviews completed.

## UX Testing Session (2026-02-24)

### Methodology
- **Tool**: Playwright MCP (browser automation via MCP plugin)
- **Approach**: Simulated real enterprise user (Ana, QA Lead at TechCorp) — first-time user, no technical knowledge of the tool
- **Scope**: Full E2E testing of all features: recording, side panel, export (all 10 formats), sessions, options, import
- **Verification**: 3-agent code review team validated all findings against source code

### Bugs Found (2)

| ID | Severity | Issue | Root Cause | File:Line |
|----|----------|-------|------------|-----------|
| BUG-01 | Critical | Cypress export crashes with `TypeError: Failed to construct 'URL'` | `new URL(nextAction.url).pathname` without try-catch when URL is empty | `cypress-exporter.ts:58,85` |
| BUG-02 | Critical | Navigate steps store empty URL string | `tab.url \|\| ''` in handleTabSwitch, missing URL in event-capture.ts navigate action | `background.ts:450`, `event-capture.ts:277` |

### UX Issues Found (23)

| ID | Priority | Category | Issue |
|----|----------|----------|-------|
| UX-01 | P2 | Popup | Too much empty space, layout not compact |
| UX-02 | P2 | Popup | "Open Review Panel" terminology unclear for first-time users |
| UX-03 | P2 | Popup | No indication which tab will be recorded |
| UX-04 | P2 | Popup | No brief explanation of what the tool does |
| UX-05 | P2 | Recording | No session naming before/during recording |
| UX-06 | P2 | Popup | Popup doesn't auto-close after starting recording |
| UX-07 | P1 | Recording | No recording indicator on the web page being recorded |
| UX-08 | P2 | Recording | Must reopen popup to see step count during recording |
| UX-09 | P3 | Capture | Fewer steps captured than expected (partially Playwright MCP limitation) |
| UX-10 | P3 | Capture | Steps captured poorly in certain scenarios (programmatic events) |
| UX-11 | P0 | Steps | "Navigated to " without URL is useless |
| UX-12 | P2 | Steps | Empty/grey thumbnails on navigate steps |
| UX-13 | P1 | Export | Export section takes half the screen (11 buttons) |
| UX-14 | P1 | Export | 10 export buttons overwhelming for first-time users |
| UX-15 | P0 | Steps | Empty URL in step detail view |
| UX-16 | P2 | Steps | No screenshot for navigate steps |
| UX-17 | P2 | Steps | "Decision Point" toggle needs tooltip/explanation |
| UX-18 | P2 | Steps | Technical CSS/XPath selectors shown to non-technical users |
| UX-19 | P2 | Sessions | Sessions with identical auto-generated names are indistinguishable |
| UX-20 | P2 | Sessions | Latest recording not appearing in session list immediately |
| UX-21 | P1 | Sessions | Session rename via double-click not discoverable (no visual hint) |
| UX-22 | P2 | Sessions | No visual indicator for active/selected session |
| UX-23 | P3 | Sessions | Import button positioning (minor) |

### Agent Team Code Review Results

**Agent 1 — UX Code Issues Review**: Confirmed all 6 critical issues with exact file paths and line numbers. Empty URL root cause traced to `background.ts:450` (`url: tab.url || ''`) and `event-capture.ts:277`. Cypress crash confirmed at `cypress-exporter.ts:58,85` — Selenium has identical pattern but with try-catch (safe).

**Agent 2 — Export Quality Review**: Comprehensive table of all 10 exporters. Cypress is the only exporter that crashes on edge cases. All others handle 0 steps, missing screenshots, and empty URLs gracefully. HTML/Markdown properly escape output.

**Agent 3 — UI Components UX Review**: Detailed component-by-component analysis. ExportPanel.tsx has 11 buttons in 175 lines with no grouping/collapsing. SessionList.tsx rename is double-click only (line 150-153), no edit icon. StepDetail.tsx shows raw CSS selectors (line 196-202). Content script injects no recording indicator UI.

### Refinement Plan (REFINE-01 to REFINE-10)

#### Sprint Refine-1 (P0 + P1 — Critical fixes and high-impact UX)

| ID | Name | Priority | Effort | Description |
|----|------|----------|--------|-------------|
| REFINE-01 | Fix empty URL in navigate steps | P0 | S | Fix root cause in background.ts and event-capture.ts. All exporters and descriptions benefit. |
| REFINE-02 | Fix Cypress exporter crash | P0 | S | Add try-catch around `new URL()` calls in cypress-exporter.ts. Add edge case tests. |
| REFINE-03 | Recording indicator on web page | P1 | M | Inject floating badge via content script. Shows state + step count. Dismissible. |
| REFINE-04 | Collapsible export panel | P1 | M | Group 11 buttons into 3 accordion sections: Documentation, Test Automation, Integrations. |
| REFINE-05 | Discoverable session rename | P1 | S | Add edit icon on hover + tooltip. Keep double-click as alternative. |

**Estimated effort**: 2S + 2M + 1S = ~1 sprint

#### Sprint Refine-2 (P2 — Quality of life improvements)

| ID | Name | Priority | Effort | Description |
|----|------|----------|--------|-------------|
| REFINE-06 | Popup UX improvements | P2 | M | Compact layout, rename button, tab indicator, description, auto-close. |
| REFINE-07 | Step detail for non-tech users | P2 | S | Hide selectors by default, tooltip for Decision Point, human-readable element info. |
| REFINE-08 | Session list improvements | P2 | S | Better auto-names, active indicator, auto-refresh, date/duration info. |
| REFINE-09 | Navigate step quality | P2 | S | Better descriptions with URL, fallback thumbnails, skip empty URLs in exports. |
| REFINE-10 | Session naming on start | P2 | S | Optional name field in popup before recording. Default auto-generated. |

**Estimated effort**: 1M + 4S = ~1 sprint

#### Implementation Order (recommended)
1. **REFINE-01 + REFINE-02** first (P0 bugs, blocks everything else)
2. **REFINE-09** next (depends on REFINE-01 for URL data)
3. **REFINE-04** (biggest visual impact for existing users)
4. **REFINE-05** (quick win, high discoverability improvement)
5. **REFINE-03** (medium effort, high user confidence improvement)
6. **REFINE-06 through REFINE-10** in any order (independent P2 items)

## Feature Completion Summary

### Done (64 features in features.json)
- **Phase 1** (P1-01 to P1-08): Core capture, selectors, screenshots, video, descriptions, storage, sidepanel, popup — all done
- **Phase 2A** (P2A-01 to P2A-11): Bugfixes, settings wiring, race conditions, password masking, reorder, delete — all done
- **Phase 2B** (P2B-01 to P2B-03): Playwright exporter, JSON exporter, HTML exporter — all done
- **Phase 2C** (P2C-01 to P2C-05): Zustand store migration, action creators, useBackgroundSync — all done
- **Phase 2D** (P2D-01 to P2D-07): Backend integration, validation, complex analysis — all done
- **Audit** (AUDIT-01 to AUDIT-05): loadState fix, VisualAnalysis types, decision badges, Playwright reliability, project hygiene — all done
- **FUTURE-01 to FUTURE-04**: Video playback, session management, JSON import, multi-tab recording
- **ROAD-01 to ROAD-27**: Markdown export, search/filter, thumbnails, onboarding, hover/right-click, GitHub Issues, export preview, undo toast, Dockerfile, screenshot format, session polling, API auth, retry, model versions, PDF, branding, Playwright+CI, Cypress, Selenium, Puppeteer

### Remaining Planned — External Infrastructure (6 features)
- **ROAD-02**: Chrome Web Store submission (P0, M) — manual process, needs store assets/privacy policy
- **ROAD-16**: Cloud sync and sharing (P1, XL) — requires external infrastructure (Supabase/Firebase)
- **ROAD-18**: Hosted AI enrichment endpoint (P1, L) — requires Cloud Run deployment
- **ROAD-19**: Team workspace (P2, XL) — requires backend + auth infrastructure
- **ROAD-22**: Jira and Linear integration (P2, L) — requires OAuth/API token flow
- **ROAD-23**: Chrome Built-in AI / Gemini Nano (P2, L) — still in origin trial, not GA

### New — UX Refinement (10 features from E2E testing)
- **REFINE-01**: Fix empty URL in navigate steps (P0, S)
- **REFINE-02**: Fix Cypress exporter crash on empty URLs (P0, S)
- **REFINE-03**: Recording indicator on web page (P1, M)
- **REFINE-04**: Collapsible export panel with categories (P1, M)
- **REFINE-05**: Discoverable session rename (P1, S)
- **REFINE-06**: Popup UX improvements (P2, M)
- **REFINE-07**: Step detail UX for non-technical users (P2, S)
- **REFINE-08**: Session list improvements (P2, S)
- **REFINE-09**: Navigate step quality improvements (P2, S)
- **REFINE-10**: Session naming on recording start (P2, S)
- **REFINE-11**: Backend AI integration discoverability (P1, M) ✅

## Completed This Session

### Gemini BYOK + EnrichmentProvider Architecture (2026-02-24)
- **REFINE-12**: Gemini BYOK direct API + EnrichmentProvider
  - Created `EnrichmentProvider` interface + factory (priority: backendUrl > geminiApiKey > none)
  - Created `GeminiDirectProvider` with combined 3-in-1 prompt (Gemini REST API direct)
  - Created `RateLimiter` for free tier (10 RPM, 250 RPD, queue-based, daily counter)
  - Created `AdkBackendProvider` wrapping existing backend-client.ts
  - Refactored background.ts to use provider pattern (dynamic import)
  - Added Gemini API key field in Options with Test Connection
  - Added `host_permissions` for generativelanguage.googleapis.com
  - Updated BackendBadge: 3 modes (green=backend, blue=Gemini, gray=none)
  - **Backend Phase 0**: Removed `BuiltInCodeExecutionTool` (broken in sub-agents per ADK limitation)
  - **Backend Phase 0**: Removed `visual_grounder` from pipeline (redundant with native bounding boxes)
  - Simplified to 3-agent parallel pipeline (screenshot_analyzer + description_generator + decision_detector)

### Backend AI Discoverability (2026-02-24)
- **REFINE-11**: Made backend AI integration discoverable and functional
  - Created `useBackendConfig` hook for reading chrome.storage.local backend settings with live updates
  - Created `BackendBadge` component (green/gray dot in sidepanel header)
  - Created `BackendSetupBanner` (dismissable banner on sessions view with Settings link)
  - Enhanced `StepDetail` with 3 AI states: loading pulse, available with sparkle, fallback placeholder
  - Added "Test Connection" buttons in Options page for both Backend URL and Standalone Agents URL
  - Added `python-dotenv` to backend for auto-loading `.env` files
  - Created `backend/.env` with correct `GOOGLE_CLOUD_PROJECT`/`GOOGLE_CLOUD_LOCATION` mapping from root `.env`
  - Fixed env var name mismatch that prevented backend from starting

### Sprint Refine-1 + Capture Hardening (2026-02-24)
- **REFINE-01 to REFINE-05**: All 5 Sprint Refine-1 features implemented
- **8 capture fixes**: startCapturing guard, contenteditable support, debounce flush, document_start, keydown, dblclick, popstate/hashchange, auto-registration
- **CI fixes**: @tailwindcss/oxide binary, prettier formatting, ESLint react-hooks errors
- **Commits**: 6 commits pushed to master (CI green)

### UX Testing & Refinement Planning (2026-02-24)
- **E2E Testing via Playwright MCP**: Full functional testing of all features as end user
- **UX Evaluation as Enterprise User**: Simulated first-time user (Ana, QA Lead) testing all workflows
- **Agent Team Code Review**: 3 agents validated findings against source code (UX issues, export quality, UI components)
- **Documented 23 UX issues** (UX-01 through UX-23) with priority classification
- **Identified 2 bugs** (Cypress crash, empty navigate URLs) with root cause analysis
- **Created 10 refinement features** (REFINE-01 through REFINE-10) in features.json
- **Designed 2-sprint refinement plan** with implementation order and effort estimates
- **Exported test recording** to `.playwright-mcp/` (JSON, Playwright spec, GitHub Actions CI YAML)

### Previous Sessions

#### Sprint 3: UX Features
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
70-72. Commit count fixes
73. `feat(extension): add Puppeteer test exporter (ROAD-27)`
74. `fix(ci): add @tailwindcss/oxide linux binary for Tailwind 4 CI`
75. `feat(extension): Sprint Refine-1 — UX fixes, capture hardening, new event types`
76. `chore: update tracking with UX testing results and refinement plan`
77. `style: format all source files with prettier`
78. `fix(extension): resolve ESLint react-hooks errors in App and UndoToast`
79. `chore: mark Sprint Refine-1 features as done (REFINE-01 to REFINE-05)`
80. `feat(extension,backend): make AI backend integration discoverable and functional`
81. `feat(extension,backend): add Gemini BYOK direct API + EnrichmentProvider architecture`
82. `fix(extension): remove unused isConfigured destructure in BackendBadge`
83. `fix(ci): exclude runtime API modules from coverage thresholds`

## 360 Audit Results (Updated 2026-02-24)

### Scores by Area
| Area | Score | Notes |
|------|-------|-------|
| Extension Code | 9.5/10 | 349 tests, 0 TS errors, 0 lint errors, 10 exporters. Bugs fixed. |
| Tests | A+ | 349 tests across 18 files, all passing |
| Features | 87% | 71/82 features done (6 external deps + 5 UX refinements planned) |
| Backend | Deployable | Dockerfile fixed, health check, API auth, env validation, consolidated |
| Documentation | 9/10 | CLAUDE.md, README, features.json, progress.md all up to date |
| Automation | 9/10 | GitHub Actions CI, ESLint + Prettier |
| Product | 9/10 | Complete workflow, but UX polish needed for non-technical users (export panel, session management, recording feedback) |
| UX | 8/10 | Sprint Refine-1 complete: recording indicator, collapsible export, discoverable rename, backend awareness. 5 P2 items remaining. |

## Known Issues

- **Build EBUSY error** (Windows): `npx wxt build` occasionally fails with `EBUSY: resource busy or locked` on `.output/` directory. Workaround: close Chrome extension devtools.
- **Offscreen document**: Chrome sometimes reports offscreen document already exists on rapid start/stop cycles. Handled with try/catch.
- **Backend flaky test**: `backend-client.test.ts` retry tests use real timer delays via `shouldAdvanceTime`. Timeout increased to 15s (commit 322cf41).
- ~~**BUG: Cypress export crash** (REFINE-02)~~: FIXED — try-catch around `new URL()` in cypress-exporter.ts
- ~~**BUG: Empty navigate URLs** (REFINE-01)~~: FIXED — tab.url guard, pendingUrl fallback in background.ts
- **Backend env var mismatch**: FIXED — created backend/.env with correct GOOGLE_CLOUD_PROJECT/LOCATION names, added python-dotenv

## Architecture Decisions

- **Zustand vanilla + useSyncExternalStore**: Preact-compatible store pattern (not useStore from zustand/react)
- **Action creators separate from store**: recording-actions.ts for async DB ops, store stays synchronous
- **Background as source of truth**: Service worker owns status/sessionId/actionCount, Zustand is UI mirror
- **ADK agent registration order**: __init__.py registers Claude in LLMRegistry before any agent imports
- **Preact (not React)**: Preact 10 with @preact/preset-vite, imports from preact/hooks and preact/compat
- **Async enrichment**: Actions stored immediately, backend enrichment runs in background, UI updates via STATUS_UPDATE
- **Optimistic deletes**: Items removed from UI instantly, committed to DB after 5s undo window
- **Export architecture**: 10 exporters (JSON, HTML, Markdown, Playwright, Playwright+CI, Cypress, Selenium, Puppeteer, PDF, GitHub Issues) all follow same pattern: pure functions taking session+actions
