import { useState, useEffect, useCallback } from 'preact/hooks';
import type { CapturedAction, RecordingSession, RecordingStatus } from '@/lib/types';
import { getSessionActions, updateAction as dbUpdateAction, getSession, reorderActions as dbReorderActions, deleteAction as dbDeleteAction } from '@/lib/storage/db';
import { RecordingControls } from './components/RecordingControls';
import { StepList } from './components/StepList';
import { StepDetail } from './components/StepDetail';
import { ExportPanel } from './components/ExportPanel';

export function App() {
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [actions, setActions] = useState<CapturedAction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');

  // Load actions when session changes
  const loadActions = useCallback(async (sessionId: string) => {
    const loaded = await getSessionActions(sessionId);
    setActions(loaded);
  }, []);

  useEffect(() => {
    // Listen for status updates to track current session
    const listener = (message: { type: string; payload?: { status: RecordingStatus; sessionId?: string; actionCount: number } }) => {
      if (message.type === 'STATUS_UPDATE' && message.payload) {
        const { sessionId, status } = message.payload;
        if (sessionId) {
          getSession(sessionId).then((s) => {
            if (s) setSession(s);
          });
          loadActions(sessionId);
        }
        if (status === 'idle') {
          // Recording ended - keep showing last session for review
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // Get initial status
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response?.sessionId) {
        getSession(response.sessionId).then((s) => {
          if (s) setSession(s);
        });
        loadActions(response.sessionId);
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [loadActions]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setView('detail');
  }

  function handleBack() {
    setView('list');
    setSelectedId(null);
  }

  async function handleUpdate(id: string, changes: Partial<CapturedAction>) {
    await dbUpdateAction(id, changes);
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...changes } : a)),
    );
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    setActions((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      const reordered = updated.map((a, i) => ({ ...a, sequenceNumber: i + 1 }));
      if (session?.id) {
        dbReorderActions(session.id, reordered.map((a) => a.id));
      }
      return reordered;
    });
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this step?')) return;
    await dbDeleteAction(id);
    setActions((prev) => prev.filter((a) => a.id !== id));
    setView('list');
    setSelectedId(null);
  }

  const selectedAction = actions.find((a) => a.id === selectedId);

  return (
    <div class="flex flex-col h-screen bg-gray-50">
      <RecordingControls />

      {view === 'detail' && selectedAction ? (
        <div class="flex-1 overflow-y-auto">
          <button
            onClick={handleBack}
            class="px-3 py-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            &larr; Back to steps
          </button>
          <StepDetail action={selectedAction} onUpdate={handleUpdate} onDelete={handleDelete} />
        </div>
      ) : (
        <StepList
          actions={actions}
          selectedId={selectedId}
          onSelect={handleSelect}
          onReorder={handleReorder}
        />
      )}

      <ExportPanel session={session} actions={actions} />
    </div>
  );
}
