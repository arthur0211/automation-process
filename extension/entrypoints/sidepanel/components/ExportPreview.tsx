import { useState, useEffect, useCallback } from 'preact/hooks';
import type { CapturedAction, RecordingSession } from '@/lib/types';

export type ExportFormat = 'json' | 'html' | 'playwright' | 'markdown';

interface ExportPreviewProps {
  session: RecordingSession;
  actions: CapturedAction[];
  initialFormat: ExportFormat;
  onClose: () => void;
  onDownload: (content: string, filename: string, mimeType: string) => void;
}

const FORMAT_CONFIG: Record<ExportFormat, { label: string; ext: string; mime: string }> = {
  json: { label: 'JSON', ext: '.json', mime: 'application/json' },
  html: { label: 'HTML', ext: '.html', mime: 'text/html' },
  playwright: { label: 'Playwright', ext: '.spec.ts', mime: 'text/plain' },
  markdown: { label: 'Markdown', ext: '.md', mime: 'text/markdown' },
};

const FORMATS: ExportFormat[] = ['json', 'html', 'playwright', 'markdown'];

export function ExportPreview({
  session,
  actions,
  initialFormat,
  onClose,
  onDownload,
}: ExportPreviewProps) {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const generateContent = useCallback(
    async (fmt: ExportFormat) => {
      setLoading(true);
      try {
        switch (fmt) {
          case 'json': {
            const { exportToJson } = await import('@/lib/export/json-exporter');
            setContent(exportToJson(session, actions));
            break;
          }
          case 'html': {
            const { exportToHtml } = await import('@/lib/export/html-exporter');
            setContent(exportToHtml(session, actions));
            break;
          }
          case 'playwright': {
            const { exportToPlaywright } = await import('@/lib/export/playwright-exporter');
            setContent(exportToPlaywright(session, actions));
            break;
          }
          case 'markdown': {
            const { exportToMarkdown } = await import('@/lib/export/markdown-exporter');
            setContent(exportToMarkdown(session, actions));
            break;
          }
        }
      } catch {
        setContent('Error generating preview.');
      } finally {
        setLoading(false);
      }
    },
    [session, actions],
  );

  useEffect(() => {
    generateContent(format);
  }, [format, generateContent]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may fail if extension lacks focus
    }
  }

  function handleDownload() {
    const cfg = FORMAT_CONFIG[format];
    onDownload(content, `${session.name}${cfg.ext}`, cfg.mime);
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).dataset.backdrop) {
      onClose();
    }
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-backdrop="true"
      onClick={handleBackdropClick}
    >
      <div class="bg-white rounded-lg shadow-xl flex flex-col w-[95vw] max-w-2xl h-[85vh] max-h-[600px]">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 class="text-sm font-semibold text-gray-800">Export Preview</h2>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
            aria-label="Close preview"
          >
            &times;
          </button>
        </div>

        {/* Format tabs */}
        <div class="flex border-b border-gray-200 px-4">
          {FORMATS.map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormat(fmt)}
              class={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                format === fmt
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {FORMAT_CONFIG[fmt].label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div class="flex-1 overflow-auto p-4 bg-gray-50">
          {loading ? (
            <div class="flex items-center justify-center h-full text-sm text-gray-400">
              Generating preview...
            </div>
          ) : (
            <pre class="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
              {content}
            </pre>
          )}
        </div>

        {/* Footer actions */}
        <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button
            onClick={handleCopy}
            disabled={loading}
            class="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
