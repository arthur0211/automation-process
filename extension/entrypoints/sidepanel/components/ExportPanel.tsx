import type { CapturedAction, RecordingSession } from '@/lib/types';

interface ExportPanelProps {
  session: RecordingSession | null;
  actions: CapturedAction[];
}

export function ExportPanel({ session, actions }: ExportPanelProps) {
  if (!session || actions.length === 0) return null;

  async function exportJson() {
    const { exportToJson } = await import('@/lib/export/json-exporter');
    const json = exportToJson(session!, actions);
    downloadFile(json, `${session!.name}.json`, 'application/json');
  }

  async function exportHtml() {
    const { exportToHtml } = await import('@/lib/export/html-exporter');
    const html = exportToHtml(session!, actions);
    downloadFile(html, `${session!.name}.html`, 'text/html');
  }

  async function exportPlaywright() {
    const { exportToPlaywright } = await import('@/lib/export/playwright-exporter');
    const code = exportToPlaywright(session!, actions);
    downloadFile(code, `${session!.name}.spec.ts`, 'text/plain');
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
      </div>
    </div>
  );
}
