import { useState } from 'preact/hooks';
import type { RecordingSession } from '@/lib/types';

interface SessionListProps {
  sessions: RecordingSession[];
  onSelect: (session: RecordingSession) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onImport: (jsonString: string) => Promise<void>;
}

const statusColors: Record<string, string> = {
  recording: 'bg-red-500',
  paused: 'bg-yellow-500',
  stopped: 'bg-gray-400',
  idle: 'bg-gray-400',
};

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateUrl(url: string, max = 40): string {
  try {
    const { hostname, pathname } = new URL(url);
    const full = hostname + pathname;
    return full.length > max ? full.slice(0, max) + '...' : full;
  } catch {
    return url.length > max ? url.slice(0, max) + '...' : url;
  }
}

export function SessionList({
  sessions,
  onSelect,
  onRename,
  onDelete,
  onImport,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  function handleImportClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setImportError(null);
        const text = await file.text();
        await onImport(text);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Import failed');
      }
    };
    input.click();
  }

  function startRename(id: string, currentName: string) {
    setEditingId(id);
    setEditValue(currentName);
  }

  function commitRename(id: string) {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== sessions.find((s) => s.id === id)?.name) {
      onRename(id, trimmed);
    }
    setEditingId(null);
  }

  function handleDelete(e: Event, id: string) {
    e.stopPropagation();
    if (confirm('Delete this recording and all its steps?')) {
      onDelete(id);
    }
  }

  if (sessions.length === 0) {
    return (
      <div class="flex-1 flex items-center justify-center p-6">
        <div class="text-center text-gray-400 text-sm">
          <div class="text-2xl mb-2">📋</div>
          <div>No recordings yet.</div>
          <div class="mt-1">Start recording to capture your first process.</div>
          <button
            onClick={handleImportClick}
            class="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
          >
            Import JSON
          </button>
          {importError && <div class="mt-2 text-xs text-red-500">{importError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div class="flex-1 overflow-y-auto">
      <div class="px-3 py-2 flex items-center justify-between border-b border-gray-200">
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Recordings ({sessions.length})
        </span>
        <button
          onClick={handleImportClick}
          class="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          Import
        </button>
      </div>
      {importError && (
        <div class="px-3 py-1.5 text-xs text-red-500 bg-red-50 border-b border-red-100">
          {importError}
        </div>
      )}
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => onSelect(session)}
          class="flex items-start gap-2 p-2.5 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50"
        >
          <span
            class={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${statusColors[session.status] || 'bg-gray-400'}`}
          />
          <div class="flex-1 min-w-0">
            {editingId === session.id ? (
              <input
                type="text"
                value={editValue}
                onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(session.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={() => commitRename(session.id)}
                onClick={(e) => e.stopPropagation()}
                class="w-full text-sm px-1 py-0.5 border border-blue-400 rounded outline-none"
                autoFocus
              />
            ) : (
              <div
                class="text-sm text-gray-800 truncate"
                onDblClick={(e) => {
                  e.stopPropagation();
                  startRename(session.id, session.name);
                }}
              >
                {session.name}
              </div>
            )}
            <div class="text-xs text-gray-400 mt-0.5 truncate">{truncateUrl(session.url)}</div>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-xs text-gray-400">{formatDate(session.startedAt)}</span>
              <span class="text-xs text-gray-400">{session.actionCount} steps</span>
            </div>
          </div>
          <button
            onClick={(e) => handleDelete(e as Event, session.id)}
            class="flex-shrink-0 px-1.5 py-0.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete recording"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
