import type { CapturedAction } from '@/lib/types';

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

export function StepList({ actions, selectedId, onSelect, onReorder }: StepListProps) {
  let dragIndex: number | null = null;

  function handleDragStart(index: number) {
    dragIndex = index;
  }

  function handleDrop(index: number) {
    if (dragIndex !== null && dragIndex !== index) {
      onReorder(dragIndex, index);
    }
    dragIndex = null;
  }

  if (actions.length === 0) {
    return (
      <div class="p-6 text-center text-gray-400 text-sm">
        No steps captured yet. Start recording to capture actions.
      </div>
    );
  }

  return (
    <div class="flex-1 overflow-y-auto">
      {actions.map((action, index) => (
        <div
          key={action.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(index)}
          onClick={() => onSelect(action.id)}
          class={`flex items-start gap-2 p-2.5 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
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
          <span class="text-xs text-gray-300 flex-shrink-0">{action.sequenceNumber}</span>
        </div>
      ))}
    </div>
  );
}
