import { recordingStore } from './recording-store';
import type { CapturedAction, StatusPayload } from '../types';
import {
  updateAction as dbUpdateAction,
  deleteAction as dbDeleteAction,
  reorderActions as dbReorderActions,
  getSession,
  getSessionActions,
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
        } else if (response.actionCount !== undefined) {
          recordingStore.setState({ actionCount: response.actionCount });
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
  }
}
