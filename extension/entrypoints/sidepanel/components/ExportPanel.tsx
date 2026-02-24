import { useState, useEffect, useRef } from 'preact/hooks';
import type { CapturedAction, RecordingSession, BrandingSettings } from '@/lib/types';
import { DEFAULT_BRANDING_SETTINGS } from '@/lib/types';
import { getVideoBlob } from '@/lib/storage/db';
import { OnboardingTooltip } from './OnboardingTooltip';
import { ExportPreview } from './ExportPreview';
import type { ExportFormat } from './ExportPreview';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface ExportPanelProps {
  session: RecordingSession | null;
  actions: CapturedAction[];
}

export function ExportPanel({ session, actions }: ExportPanelProps) {
  const [copied, setCopied] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<ExportFormat | null>(null);
  const [showGitHubForm, setShowGitHubForm] = useState(false);
  const [ghRepo, setGhRepo] = useState('');
  const [ghTitle, setGhTitle] = useState('');
  const [ghLabels, setGhLabels] = useState('');
  const [ghAssignee, setGhAssignee] = useState('');
  const [ghSubmitting, setGhSubmitting] = useState(false);
  const [ghResult, setGhResult] = useState<{ url: string; number: number } | null>(null);
  const [ghError, setGhError] = useState('');
  const brandingRef = useRef<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [openSection, setOpenSection] = useState<string | null>('documentation');

  useEffect(() => {
    chrome.storage.local.get(['brandingSettings'], (result) => {
      if (result.brandingSettings) {
        brandingRef.current = {
          ...DEFAULT_BRANDING_SETTINGS,
          ...(result.brandingSettings as BrandingSettings),
        };
      }
    });
  }, []);

  useEffect(() => {
    if (showGitHubForm) {
      chrome.storage.local.get(['github_repo'], (result) => {
        if (result.github_repo) setGhRepo(result.github_repo as string);
      });
      if (session) setGhTitle(session.name);
    }
  }, [showGitHubForm, session]);

  if (!session || actions.length === 0) return null;

  async function exportJson() {
    const { exportToJson } = await import('@/lib/export/json-exporter');
    const json = exportToJson(session!, actions);
    downloadFile(json, `${session!.name}.json`, 'application/json');
  }

  async function exportHtml() {
    const { exportToHtml } = await import('@/lib/export/html-exporter');
    let videoDataUrl: string | undefined;
    try {
      const videoBlob = await getVideoBlob(session!.id);
      if (videoBlob) videoDataUrl = await blobToDataUrl(videoBlob);
    } catch {
      // Non-fatal: export without video
    }
    const html = exportToHtml(session!, actions, videoDataUrl, brandingRef.current);
    downloadFile(html, `${session!.name}.html`, 'text/html');
  }

  async function exportPlaywright() {
    const { exportToPlaywright } = await import('@/lib/export/playwright-exporter');
    const code = exportToPlaywright(session!, actions);
    downloadFile(code, `${session!.name}.spec.ts`, 'text/plain');
  }

  async function exportCypress() {
    const { exportToCypress } = await import('@/lib/export/cypress-exporter');
    const code = exportToCypress(session!, actions);
    downloadFile(code, `${session!.name}.cy.ts`, 'text/plain');
  }

  async function exportSelenium() {
    const { exportToSelenium } = await import('@/lib/export/selenium-exporter');
    const code = exportToSelenium(session!, actions);
    downloadFile(code, `${session!.name}.selenium.js`, 'text/plain');
  }

  async function exportPuppeteer() {
    const { exportToPuppeteer } = await import('@/lib/export/puppeteer-exporter');
    const code = exportToPuppeteer(session!, actions);
    downloadFile(code, `${session!.name}.puppeteer.js`, 'text/plain');
  }

  async function exportPlaywrightCI() {
    const { exportPlaywrightWithCI } = await import('@/lib/export/playwright-ci-exporter');
    const { testFile, workflowFile } = exportPlaywrightWithCI(session!, actions);
    downloadFile(testFile, `${session!.name}.spec.ts`, 'text/plain');
    // Small delay so the browser does not block the second download
    setTimeout(() => {
      downloadFile(workflowFile, 'playwright.yml', 'text/yaml');
    }, 100);
  }

  async function exportPdf() {
    const { exportToPdf } = await import('@/lib/export/pdf-exporter');
    exportToPdf(session!, actions);
  }

  async function exportMarkdown() {
    const { exportToMarkdown } = await import('@/lib/export/markdown-exporter');
    const md = exportToMarkdown(session!, actions);
    downloadFile(md, `${session!.name}.md`, 'text/markdown');
  }

  async function copyMarkdown() {
    try {
      const { exportToMarkdown } = await import('@/lib/export/markdown-exporter');
      const md = exportToMarkdown(session!, actions);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Non-fatal: clipboard may fail if extension lacks focus
    }
  }

  async function handleGitHubSubmit() {
    setGhError('');
    setGhResult(null);
    setGhSubmitting(true);

    try {
      const stored = await chrome.storage.local.get('github_pat');
      const token = stored.github_pat as string | undefined;
      if (!token) {
        setGhError('GitHub PAT not configured. Set it in extension Options.');
        setGhSubmitting(false);
        return;
      }
      if (!ghRepo || !ghRepo.includes('/')) {
        setGhError('Enter a valid repository in "owner/repo" format.');
        setGhSubmitting(false);
        return;
      }

      const { exportToMarkdown } = await import('@/lib/export/markdown-exporter');
      const body = exportToMarkdown(session!, actions);

      const { createGitHubIssue } = await import('@/lib/export/github-exporter');
      const labels = ghLabels
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
      const result = await createGitHubIssue({
        token,
        repo: ghRepo,
        title: ghTitle || session!.name,
        body,
        labels: labels.length > 0 ? labels : undefined,
        assignee: ghAssignee.trim() || undefined,
      });
      setGhResult(result);
    } catch (err) {
      setGhError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGhSubmitting(false);
    }
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/[^a-z0-9._-]/gi, '_');
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSection(section: string) {
    setOpenSection((prev) => (prev === section ? null : section));
  }

  return (
    <div class="p-3 border-t border-gray-200 bg-white">
      <label class="block text-xs font-medium text-gray-500 mb-2">Export</label>
      <OnboardingTooltip storageKey="onboarding_export_seen">
        <strong>Export your recording:</strong> <strong>JSON</strong> for LLM processing,{' '}
        <strong>HTML</strong> for a visual step-by-step guide, or <strong>Playwright</strong> to
        generate an automated test script.
      </OnboardingTooltip>

      {/* Always-visible actions */}
      <div class="flex gap-2 mb-3">
        <button
          onClick={copyMarkdown}
          class="flex-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
        <button
          onClick={() => setPreviewFormat('json')}
          class="flex-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
        >
          Preview
        </button>
      </div>

      {/* Accordion sections */}
      <div class="space-y-1">
        {/* Section 1: Documentation */}
        <div class="rounded-md overflow-hidden">
          <button
            onClick={() => toggleSection('documentation')}
            class="w-full bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded cursor-pointer flex items-center justify-between text-sm font-medium text-gray-700 transition-colors"
          >
            <span class="flex items-center gap-2">
              <svg
                class="w-4 h-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Documentation
              <span class="text-xs font-normal text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">
                4
              </span>
            </span>
            <svg
              class={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openSection === 'documentation' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            class="transition-all duration-200 ease-in-out overflow-hidden"
            style={{ maxHeight: openSection === 'documentation' ? '200px' : '0px' }}
          >
            <div class="px-3 pb-2 pt-2 grid grid-cols-2 gap-2">
              <button
                onClick={exportJson}
                class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                JSON (LLM)
              </button>
              <button
                onClick={exportHtml}
                class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                HTML (Human)
              </button>
              <button
                onClick={exportMarkdown}
                class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Markdown
              </button>
              <button
                onClick={exportPdf}
                class="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
              >
                PDF (Print)
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Test Automation */}
        <div class="rounded-md overflow-hidden">
          <button
            onClick={() => toggleSection('testing')}
            class="w-full bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded cursor-pointer flex items-center justify-between text-sm font-medium text-gray-700 transition-colors"
          >
            <span class="flex items-center gap-2">
              <svg
                class="w-4 h-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              Test Automation
              <span class="text-xs font-normal text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">
                5
              </span>
            </span>
            <svg
              class={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openSection === 'testing' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            class="transition-all duration-200 ease-in-out overflow-hidden"
            style={{ maxHeight: openSection === 'testing' ? '200px' : '0px' }}
          >
            <div class="px-3 pb-2 pt-2 grid grid-cols-2 gap-2">
              <button
                onClick={exportPlaywright}
                class="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
              >
                Playwright
              </button>
              <button
                onClick={exportPlaywrightCI}
                class="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
              >
                Playwright + CI
              </button>
              <button
                onClick={exportCypress}
                class="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-md hover:bg-teal-100 transition-colors"
              >
                Cypress
              </button>
              <button
                onClick={exportSelenium}
                class="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors"
              >
                Selenium
              </button>
              <button
                onClick={exportPuppeteer}
                class="col-span-2 px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 rounded-md hover:bg-yellow-100 transition-colors"
              >
                Puppeteer
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Integrations */}
        <div class="rounded-md overflow-hidden">
          <button
            onClick={() => toggleSection('integrations')}
            class="w-full bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded cursor-pointer flex items-center justify-between text-sm font-medium text-gray-700 transition-colors"
          >
            <span class="flex items-center gap-2">
              <svg
                class="w-4 h-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              Integrations
              <span class="text-xs font-normal text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">
                1
              </span>
            </span>
            <svg
              class={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openSection === 'integrations' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            class="transition-all duration-200 ease-in-out overflow-hidden"
            style={{ maxHeight: openSection === 'integrations' ? '500px' : '0px' }}
          >
            <div class="px-3 pb-2 pt-2">
              <button
                onClick={() => {
                  setShowGitHubForm(!showGitHubForm);
                  setGhResult(null);
                  setGhError('');
                }}
                class="w-full px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
              >
                {showGitHubForm ? 'Cancel' : 'Create GitHub Issue'}
              </button>
              {showGitHubForm && (
                <div class="mt-2 p-3 bg-white rounded-md border border-gray-200 space-y-2">
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-0.5">Repository</label>
                    <input
                      type="text"
                      placeholder="owner/repo"
                      value={ghRepo}
                      onInput={(e) => setGhRepo((e.target as HTMLInputElement).value)}
                      class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-0.5">Title</label>
                    <input
                      type="text"
                      placeholder="Issue title"
                      value={ghTitle}
                      onInput={(e) => setGhTitle((e.target as HTMLInputElement).value)}
                      class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-0.5">
                      Labels{' '}
                      <span class="text-gray-400 font-normal">(comma-separated, optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="bug, documentation"
                      value={ghLabels}
                      onInput={(e) => setGhLabels((e.target as HTMLInputElement).value)}
                      class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-0.5">
                      Assignee <span class="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="username"
                      value={ghAssignee}
                      onInput={(e) => setGhAssignee((e.target as HTMLInputElement).value)}
                      class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <button
                    onClick={handleGitHubSubmit}
                    disabled={ghSubmitting}
                    class="w-full px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {ghSubmitting ? 'Creating...' : 'Create Issue'}
                  </button>
                  {ghResult && (
                    <div class="text-xs text-green-700 bg-green-50 p-2 rounded">
                      Issue #{ghResult.number} created.{' '}
                      <a
                        href={ghResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="underline font-medium"
                      >
                        Open on GitHub
                      </a>
                    </div>
                  )}
                  {ghError && (
                    <div class="text-xs text-red-600 bg-red-50 p-2 rounded">{ghError}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {previewFormat && (
        <ExportPreview
          session={session}
          actions={actions}
          initialFormat={previewFormat}
          onClose={() => setPreviewFormat(null)}
          onDownload={downloadFile}
        />
      )}
    </div>
  );
}
