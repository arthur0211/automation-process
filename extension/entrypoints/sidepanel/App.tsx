import type { CapturedAction } from '@/lib/types';
import { useRecordingStore } from '@/lib/stores/recording-store';
import { useBackgroundSync } from '@/lib/hooks/use-background-sync';
import {
  updateActionWithDb,
  deleteActionWithDb,
  reorderActionsWithDb,
  loadSessionActions,
  renameSessionWithDb,
  deleteSessionWithDb,
  importSessionFromJson,
} from '@/lib/stores/recording-actions';
import { RecordingControls } from './components/RecordingControls';
import { StepList } from './components/StepList';
import { StepDetail } from './components/StepDetail';
import { ExportPanel } from './components/ExportPanel';
import { ValidationPanel } from './components/ValidationPanel';
import { VideoPlayer } from './components/VideoPlayer';
import { SessionList } from './components/SessionList';

export function App() {
  useBackgroundSync();

  const session = useRecordingStore((s) => s.session);
  const sessions = useRecordingStore((s) => s.sessions);
  const actions = useRecordingStore((s) => s.actions);
  const selectedActionId = useRecordingStore((s) => s.selectedActionId);
  const view = useRecordingStore((s) => s.view);
  const status = useRecordingStore((s) => s.status);
  const selectAction = useRecordingStore((s) => s.selectAction);
  const clearSelection = useRecordingStore((s) => s.clearSelection);
  const backToSessions = useRecordingStore((s) => s.backToSessions);

  function handleSelect(id: string) {
    selectAction(id);
  }

  function handleBack() {
    clearSelection();
  }

  async function handleUpdate(id: string, changes: Partial<CapturedAction>) {
    await updateActionWithDb(id, changes);
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    if (session?.id) {
      reorderActionsWithDb(session.id, fromIndex, toIndex);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this step?')) return;
    await deleteActionWithDb(id);
  }

  const selectedAction = actions.find((a) => a.id === selectedActionId);

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
      ) : view === 'list' ? (
        <>
          {(status === 'idle' || status === 'stopped') && (
            <button
              onClick={backToSessions}
              class="px-3 py-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 border-b border-gray-100"
            >
              &larr; All recordings
            </button>
          )}
          <StepList
            actions={actions}
            selectedId={selectedActionId}
            onSelect={handleSelect}
            onReorder={handleReorder}
          />
        </>
      ) : (
        <SessionList
          sessions={sessions}
          onSelect={loadSessionActions}
          onRename={renameSessionWithDb}
          onDelete={deleteSessionWithDb}
          onImport={importSessionFromJson}
        />
      )}

      {session && status !== 'recording' && status !== 'paused' && (
        <VideoPlayer sessionId={session.id} />
      )}
      <ValidationPanel session={session} />
      <ExportPanel session={session} actions={actions} />
    </div>
  );
}
