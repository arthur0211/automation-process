import { useState, useEffect } from 'preact/hooks';
import type { CapturedAction } from '@/lib/types';
import { NoteEditor } from './NoteEditor';

interface StepDetailProps {
  action: CapturedAction;
  onUpdate: (id: string, changes: Partial<CapturedAction>) => void;
  onDelete: (id: string) => void;
}

export function StepDetail({ action, onUpdate, onDelete }: StepDetailProps) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(action.description);

  useEffect(() => {
    setDescValue(action.description);
    setEditingDesc(false);
  }, [action.id, action.description]);

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
        <label class="block text-xs font-medium text-gray-500 mb-1">
          Description
        </label>
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
                onClick={() => { setDescValue(action.description); setEditingDesc(false); }}
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

      {/* AI Description (from backend enrichment) */}
      {action.llmDescription && (
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">AI Description</label>
          <p class="text-sm text-gray-800 bg-blue-50 px-2 py-1.5 rounded">
            {action.llmDescription}
          </p>
        </div>
      )}

      {/* Visual Analysis (from backend enrichment) */}
      {action.llmVisualAnalysis && (
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Visual Analysis</label>
          <div class="text-xs text-gray-600 bg-gray-50 px-2 py-1.5 rounded space-y-0.5">
            {(action.llmVisualAnalysis as Record<string, any>).pageContext?.section && (
              <p><span class="text-gray-400">Section:</span> {(action.llmVisualAnalysis as Record<string, any>).pageContext.section}</p>
            )}
            {(action.llmVisualAnalysis as Record<string, any>).layout && (
              <p><span class="text-gray-400">Layout:</span> {(action.llmVisualAnalysis as Record<string, any>).layout}</p>
            )}
            {(action.llmVisualAnalysis as Record<string, any>).interactedElement?.description && (
              <p><span class="text-gray-400">Element:</span> {(action.llmVisualAnalysis as Record<string, any>).interactedElement.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Decision Point Toggle */}
      <div class="flex items-center gap-2">
        <label class="text-xs font-medium text-gray-500">Decision Point</label>
        <button
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
          <span class="text-gray-700 font-mono text-[10px] truncate" title={action.element.selectors.css}>
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
      <NoteEditor
        note={action.note}
        onSave={(note) => onUpdate(action.id, { note })}
      />
    </div>
  );
}
