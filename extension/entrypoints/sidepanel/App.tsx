import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import type { CapturedAction, RecordingSession } from '@/lib/types';
import { useRecordingStore, recordingStore } from '@/lib/stores/recording-store';
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
import { BackendSetupBanner } from './components/BackendSetupBanner';
import { UndoToast } from './components/UndoToast';

type PendingDelete =
  | { type: 'action'; id: string; item: CapturedAction }
  | { type: 'session'; id: string; item: RecordingSession };

const UNDO_DURATION = 5000;

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

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingRef = useRef<PendingDelete | null>(null);
  useEffect(() => {
    pendingRef.current = pendingDelete;
  });

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

  function handleDeleteAction(id: string) {
    const item = actions.find((a) => a.id === id);
    if (!item) return;
    // Optimistically remove from UI
    const { removeAction } = recordingStore.getState();
    removeAction(id);
    clearSelection();
    setPendingDelete({ type: 'action', id, item });
  }

  function handleDeleteSession(id: string) {
    const item = sessions.find((s) => s.id === id);
    if (!item) return;
    // Optimistically remove from UI
    const state = recordingStore.getState();
    state.setSessions(sessions.filter((s) => s.id !== id));
    if (session?.id === id) {
      state.backToSessions();
    }
    setPendingDelete({ type: 'session', id, item });
  }

  const handleUndoDismiss = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    setPendingDelete(null);
    // Commit the actual DB delete
    if (pending.type === 'action') {
      await deleteActionWithDb(pending.id);
    } else {
      await deleteSessionWithDb(pending.id);
    }
  }, []);

  const handleUndo = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    setPendingDelete(null);
    // Restore the item to the store
    if (pending.type === 'action') {
      const { actions: currentActions } = recordingStore.getState();
      const restored = [...currentActions, pending.item].sort(
        (a, b) => a.sequenceNumber - b.sequenceNumber,
      );
      recordingStore.getState().setActions(restored);
    } else {
      const { sessions: currentSessions } = recordingStore.getState();
      recordingStore.getState().setSessions([...currentSessions, pending.item]);
    }
  }, []);

  const selectedAction = actions.find((a) => a.id === selectedActionId);

  return (
    <div class="flex flex-col h-screen bg-gray-50">
      <RecordingControls />

      {view === 'sessions' && <BackendSetupBanner />}

      {view === 'detail' && selectedAction ? (
        <div class="flex-1 overflow-y-auto">
          <button
            onClick={handleBack}
            class="px-3 py-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            &larr; Back to steps
          </button>
          <StepDetail
            action={selectedAction}
            onUpdate={handleUpdate}
            onDelete={handleDeleteAction}
          />
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
          onDelete={handleDeleteSession}
          onImport={importSessionFromJson}
        />
      )}

      {session && status !== 'recording' && status !== 'paused' && (
        <VideoPlayer sessionId={session.id} />
      )}
      <ValidationPanel session={session} />
      <ExportPanel session={session} actions={actions} />

      {pendingDelete && (
        <UndoToast
          message={pendingDelete.type === 'action' ? 'Step deleted' : 'Recording deleted'}
          onUndo={handleUndo}
          onDismiss={handleUndoDismiss}
          duration={UNDO_DURATION}
        />
      )}
    </div>
  );
}
