import { useState, useEffect } from 'preact/hooks';
import type { CapturedAction } from '@/lib/types';
import { NoteEditor } from './NoteEditor';

const ENRICHMENT_TIMEOUT_MS = 60_000;

interface StepDetailProps {
  action: CapturedAction;
  onUpdate: (id: string, changes: Partial<CapturedAction>) => void;
  onDelete: (id: string) => void;
}

export function StepDetail({ action, onUpdate, onDelete }: StepDetailProps) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(action.description);
  const [enrichmentTimedOut, setEnrichmentTimedOut] = useState(false);

  useEffect(() => {
    setDescValue(action.description);
    setEditingDesc(false);
  }, [action.id, action.description]);

  useEffect(() => {
    if (action.llmDescription) {
      setEnrichmentTimedOut(false);
      return;
    }

    const age = Date.now() - action.timestamp;
    if (age >= ENRICHMENT_TIMEOUT_MS) {
      setEnrichmentTimedOut(true);
      return;
    }

    const timer = setTimeout(() => setEnrichmentTimedOut(true), ENRICHMENT_TIMEOUT_MS - age);
    return () => clearTimeout(timer);
  }, [action.id, action.llmDescription, action.timestamp]);

  function saveDescription() {
    onUpdate(action.id, { description: descValue });
    setEditingDesc(false);
  }

  return (
    <div class="p-3 space-y-3">
      {/* Screenshot */}
      {action.screenshotDataUrl && (
        <div class="rounded-md overflow-hidden border border-gray-200">
          <img
            src={action.screenshotDataUrl}
            alt={`Step ${action.sequenceNumber}`}
            class="w-full h-auto"
          />
        </div>
      )}

      {/* Description */}
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Description</label>
        {editingDesc ? (
          <div>
            <textarea
              value={descValue}
              onInput={(e) => setDescValue((e.target as HTMLTextAreaElement).value)}
              class="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              rows={2}
            />
            <div class="flex gap-1 mt-1">
              <button
                onClick={saveDescription}
                class="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setDescValue(action.description);
                  setEditingDesc(false);
                }}
                class="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p
            onClick={() => setEditingDesc(true)}
            class="text-sm text-gray-800 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
            title="Click to edit"
          >
            {action.description || 'No description (click to add)'}
          </p>
        )}
      </div>

      {/* AI Analysis */}
      {action.llmDescription ? (
        <div class="space-y-2">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">
              <span class="text-amber-500 mr-1">✦</span>AI Analysis
            </label>
            <p class="text-sm text-gray-800 bg-blue-50 px-2 py-1.5 rounded">
              {action.llmDescription}
            </p>
          </div>

          {action.llmVisualAnalysis && (
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">
                <span class="text-amber-500 mr-1">✦</span>Visual Analysis
                {action.llmVisualAnalysis.reasoning && (
                  <span class="ml-1 px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-600 rounded">
                    Deep Analysis
                  </span>
                )}
              </label>
              <div class="text-xs text-gray-600 bg-gray-50 px-2 py-1.5 rounded space-y-0.5">
                {action.llmVisualAnalysis.pageContext?.section && (
                  <p>
                    <span class="text-gray-400">Section:</span>{' '}
                    {action.llmVisualAnalysis.pageContext.section}
                  </p>
                )}
                {action.llmVisualAnalysis.layout && (
                  <p>
                    <span class="text-gray-400">Layout:</span> {action.llmVisualAnalysis.layout}
                  </p>
                )}
                {action.llmVisualAnalysis.interactedElement?.description && (
                  <p>
                    <span class="text-gray-400">Element:</span>{' '}
                    {action.llmVisualAnalysis.interactedElement.description}
                  </p>
                )}
                {action.llmVisualAnalysis.confidence !== undefined && (
                  <p>
                    <span class="text-gray-400">Confidence:</span>{' '}
                    {(action.llmVisualAnalysis.confidence * 100).toFixed(0)}%
                  </p>
                )}
                {action.llmVisualAnalysis.reasoning && (
                  <p>
                    <span class="text-gray-400">Reasoning:</span>{' '}
                    {action.llmVisualAnalysis.reasoning}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : enrichmentTimedOut ? (
        <div class="border border-dashed border-gray-300 rounded-md px-3 py-2.5">
          <p class="text-xs text-gray-400">AI analysis not available</p>
          <p class="text-[10px] text-gray-400 mt-1">
            Configure the backend in{' '}
            <button
              type="button"
              onClick={() => chrome.runtime.openOptionsPage()}
              class="underline text-blue-500 hover:text-blue-600 cursor-pointer"
            >
              Settings
            </button>{' '}
            to enable AI-powered descriptions and visual analysis
          </p>
        </div>
      ) : (
        <div class="flex items-center gap-2 px-3 py-2">
          <span class="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          <span class="text-xs text-gray-400">Analyzing...</span>
        </div>
      )}

      {/* Decision Point Toggle */}
      <div class="flex items-center gap-2">
        <label class="text-xs font-medium text-gray-500">Decision Point</label>
        <button
          role="switch"
          aria-checked={action.decisionPoint.isDecisionPoint}
          aria-label="Toggle decision point"
          onClick={() =>
            onUpdate(action.id, {
              decisionPoint: {
                ...action.decisionPoint,
                isDecisionPoint: !action.decisionPoint.isDecisionPoint,
              },
            })
          }
          class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            action.decisionPoint.isDecisionPoint ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            class={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              action.decisionPoint.isDecisionPoint ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>
        {action.decisionPoint.isDecisionPoint && action.decisionPoint.reason && (
          <p class="text-xs text-gray-500">{action.decisionPoint.reason}</p>
        )}
        {action.decisionPoint.branches.length > 0 && (
          <ul class="space-y-0.5">
            {action.decisionPoint.branches.map((b, i) => (
              <li key={i} class="text-xs text-gray-500">
                <span class="font-medium">{b.condition}:</span> {b.description}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Metadata */}
      <div class="space-y-1.5">
        <label class="block text-xs font-medium text-gray-500">Details</label>
        <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span class="text-gray-400">Action</span>
          <span class="text-gray-700">{action.actionType}</span>

          <span class="text-gray-400">Element</span>
          <span class="text-gray-700 font-mono truncate" title={action.element.selectors.css}>
            {action.element.tag}
            {action.element.id ? `#${action.element.id}` : ''}
          </span>

          <span class="text-gray-400">URL</span>
          <span class="text-gray-700 truncate" title={action.url}>
            {action.url}
          </span>

          {action.inputValue && (
            <>
              <span class="text-gray-400">Value</span>
              <span class="text-gray-700 truncate">{action.inputValue}</span>
            </>
          )}

          <span class="text-gray-400">CSS</span>
          <span
            class="text-gray-700 font-mono text-[10px] truncate"
            title={action.element.selectors.css}
          >
            {action.element.selectors.css}
          </span>
        </div>
      </div>

      {/* Delete */}
      <div class="pt-2 border-t border-gray-200">
        <button
          onClick={() => onDelete(action.id)}
          class="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
        >
          Delete Step
        </button>
      </div>

      {/* Notes */}
      <NoteEditor note={action.note} onSave={(note) => onUpdate(action.id, { note })} />
    </div>
  );
}
