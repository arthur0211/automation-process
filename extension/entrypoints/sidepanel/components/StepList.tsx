import { useRef, useState, useEffect } from 'preact/hooks';
import type { CapturedAction, ActionType } from '@/lib/types';
import { useRecordingStore } from '@/lib/stores/recording-store';

interface StepListProps {
  actions: CapturedAction[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const actionIcons: Record<string, string> = {
  click: '🖱',
  input: '⌨',
  scroll: '↕',
  navigate: '🔗',
  submit: '📤',
};

const filterOptions: { value: ActionType | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'click', label: 'Click' },
  { value: 'input', label: 'Input' },
  { value: 'scroll', label: 'Scroll' },
  { value: 'navigate', label: 'Navigate' },
  { value: 'submit', label: 'Submit' },
];

export function StepList({ actions, selectedId, onSelect, onReorder }: StepListProps) {
  const dragIndexRef = useRef<number | null>(null);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const searchQuery = useRecordingStore((s) => s.searchQuery);
  const filterType = useRecordingStore((s) => s.filterType);
  const setSearchQuery = useRecordingStore((s) => s.setSearchQuery);
  const setFilterType = useRecordingStore((s) => s.setFilterType);

  const filteredActions = actions.filter((a) => {
    const matchesSearch =
      !searchQuery ||
      (a.llmDescription || a.description).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || a.actionType === filterType;
    return matchesSearch && matchesType;
  });

  const hasActiveFilter = searchQuery !== '' || filterType !== null;

  useEffect(() => {
    chrome.storage.local.get(['showThumbnails'], (result) => {
      if (result.showThumbnails !== undefined) {
        setShowThumbnails(result.showThumbnails as boolean);
      }
    });
  }, []);

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDrop(index: number) {
    if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
      onReorder(dragIndexRef.current, index);
    }
    dragIndexRef.current = null;
  }

  function handleClearFilters() {
    setSearchQuery('');
    setFilterType(null);
  }

  if (actions.length === 0) {
    return (
      <div class="p-6 text-center text-gray-400 text-sm">
        No steps captured yet. Start recording to capture actions.
      </div>
    );
  }

  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Search and filter bar */}
      <div class="px-2.5 py-2 border-b border-gray-200 bg-white space-y-1.5">
        <div class="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Search steps..."
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            class="flex-1 text-sm px-2 py-1 border border-gray-200 rounded bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400"
          />
          <select
            value={filterType || ''}
            onChange={(e) => {
              const val = (e.target as HTMLSelectElement).value;
              setFilterType(val ? (val as ActionType) : null);
            }}
            class="text-sm px-1.5 py-1 border border-gray-200 rounded bg-white text-gray-700 focus:outline-none focus:border-blue-400"
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div class="flex items-center justify-between text-xs text-gray-500">
          <span>
            {filteredActions.length} of {actions.length} steps
          </span>
          {hasActiveFilter && (
            <button
              onClick={handleClearFilters}
              class="text-gray-400 hover:text-gray-600 transition-colors"
              title="Clear filters"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Step list */}
      <div class="flex-1 overflow-y-auto">
        {filteredActions.length === 0 ? (
          <div class="p-6 text-center text-gray-400 text-sm">
            No steps match the current filter.
          </div>
        ) : (
          filteredActions.map((action, index) => (
            <div
              key={action.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              onClick={() => onSelect(action.id)}
              class={`flex items-center gap-2 p-2.5 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
                selectedId === action.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <span class="text-base flex-shrink-0 mt-0.5" title={action.actionType}>
                {actionIcons[action.actionType] || '•'}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-gray-800 truncate">
                  {action.description || `Step ${action.sequenceNumber}`}
                  {action.decisionPoint?.isDecisionPoint && (
                    <span class="inline-block ml-1 px-1 py-0.5 text-[9px] bg-amber-50 text-amber-600 rounded font-medium">
                      Decision
                    </span>
                  )}
                </div>
                <div class="text-xs text-gray-400 mt-0.5 truncate">{action.pageTitle}</div>
              </div>
              {showThumbnails &&
                (action.screenshotDataUrl ? (
                  <img
                    src={action.screenshotDataUrl}
                    alt=""
                    class="w-12 h-9 object-cover rounded flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div class="w-12 h-9 bg-gray-100 rounded flex-shrink-0" />
                ))}
              <span class="text-xs text-gray-300 flex-shrink-0">{action.sequenceNumber}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
