import { recordingStore } from './recording-store';
import type { CapturedAction, StatusPayload } from '../types';
import {
  updateAction as dbUpdateAction,
  deleteAction as dbDeleteAction,
  reorderActions as dbReorderActions,
  getSession,
  getSessionActions,
  getAllSessions,
  deleteSession as dbDeleteSession,
  updateSession as dbUpdateSession,
} from '../storage/db';

export async function updateActionWithDb(id: string, changes: Partial<CapturedAction>): Promise<void> {
  await dbUpdateAction(id, changes);
  recordingStore.getState().updateAction(id, changes);
}

export async function deleteActionWithDb(id: string): Promise<void> {
  await dbDeleteAction(id);
  const { removeAction, clearSelection } = recordingStore.getState();
  removeAction(id);
  clearSelection();
}

export async function reorderActionsWithDb(sessionId: string, fromIndex: number, toIndex: number): Promise<void> {
  const actions = [...recordingStore.getState().actions];
  const [moved] = actions.splice(fromIndex, 1);
  actions.splice(toIndex, 0, moved);
  const reordered = actions.map((a, i) => ({ ...a, sequenceNumber: i + 1 }));
  recordingStore.getState().setActions(reordered);
  await dbReorderActions(sessionId, reordered.map((a) => a.id));
}

export async function loadSessions(): Promise<void> {
  const sessions = await getAllSessions();
  recordingStore.getState().setSessions(sessions);
}

export async function loadSessionActions(session: import('../types').RecordingSession): Promise<void> {
  const actions = await getSessionActions(session.id);
  recordingStore.getState().selectSession(session);
  recordingStore.getState().setActions(actions);
}

export async function renameSessionWithDb(id: string, name: string): Promise<void> {
  await dbUpdateSession(id, { name });
  const { sessions, session } = recordingStore.getState();
  recordingStore.getState().setSessions(sessions.map((s) => (s.id === id ? { ...s, name } : s)));
  if (session?.id === id) {
    recordingStore.getState().setSession({ ...session, name });
  }
}

export async function deleteSessionWithDb(id: string): Promise<void> {
  await dbDeleteSession(id);
  const { sessions, session } = recordingStore.getState();
  recordingStore.getState().setSessions(sessions.filter((s) => s.id !== id));
  if (session?.id === id) {
    recordingStore.getState().backToSessions();
  }
}

export async function syncFromBackground(): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, async (response) => {
      if (response && !chrome.runtime.lastError) {
        recordingStore.getState().setStatus(response.status);
        if (response.sessionId) {
          const [session, actions] = await Promise.all([
            getSession(response.sessionId),
            getSessionActions(response.sessionId),
          ]);
          if (session) recordingStore.getState().setSession(session);
          recordingStore.getState().setActions(actions);
          recordingStore.setState({ view: 'list' });
        } else {
          await loadSessions();
          recordingStore.setState({ view: 'sessions' });
        }
      }
      resolve();
    });
  });
}

export async function handleStatusUpdate(payload: StatusPayload): Promise<void> {
  recordingStore.getState().setStatus(payload.status);
  if (payload.sessionId) {
    const [session, actions] = await Promise.all([
      getSession(payload.sessionId),
      getSessionActions(payload.sessionId),
    ]);
    if (session) recordingStore.getState().setSession(session);
    recordingStore.getState().setActions(actions);
  } else if (payload.status === 'idle') {
    await loadSessions();
    recordingStore.setState({ view: 'sessions' });
  }
}
