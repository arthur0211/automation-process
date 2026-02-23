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

  useEffect(() => {
    chrome.storage.local.get(['brandingSettings'], (result) => {
      if (result.brandingSettings) {
        brandingRef.current = { ...DEFAULT_BRANDING_SETTINGS, ...(result.brandingSettings as BrandingSettings) };
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

  return (
    <div class="p-3 border-t border-gray-200 bg-white">
      <label class="block text-xs font-medium text-gray-500 mb-2">Export</label>
      <OnboardingTooltip storageKey="onboarding_export_seen">
        <strong>Export your recording:</strong> <strong>JSON</strong> for LLM processing,{' '}
        <strong>HTML</strong> for a visual step-by-step guide, or{' '}
        <strong>Playwright</strong> to generate an automated test script.
      </OnboardingTooltip>
      <div class="flex gap-2">
        <button
          onClick={exportJson}
          class="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          JSON (LLM)
        </button>
        <button
          onClick={exportHtml}
          class="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          HTML (Human)
        </button>
        <button
          onClick={exportPlaywright}
          class="flex-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
        >
          Playwright (.spec.ts)
        </button>
        <button
          onClick={exportCypress}
          class="flex-1 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-md hover:bg-teal-100 transition-colors"
        >
          Cypress (.cy.ts)
        </button>
      </div>
      <div class="flex gap-2 mt-2">
        <button
          onClick={exportPdf}
          class="flex-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
        >
          PDF (Print)
        </button>
        <button
          onClick={exportMarkdown}
          class="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          Markdown
        </button>
        <button
          onClick={copyMarkdown}
          class="flex-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div class="mt-2">
        <button
          onClick={() => setPreviewFormat('json')}
          class="w-full px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
        >
          Preview Export
        </button>
      </div>
      <div class="mt-2">
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
      </div>
      {showGitHubForm && (
        <div class="mt-2 p-3 bg-gray-50 rounded-md space-y-2">
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
          {ghError && <div class="text-xs text-red-600 bg-red-50 p-2 rounded">{ghError}</div>}
        </div>
      )}
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
