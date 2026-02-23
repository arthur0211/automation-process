import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordingStore } from '@/lib/stores/recording-store';
import { db } from '@/lib/storage/db';
import {
  updateActionWithDb,
  deleteActionWithDb,
  reorderActionsWithDb,
  handleStatusUpdate,
  syncFromBackground,
  loadSessions,
  loadSessionActions,
  renameSessionWithDb,
  deleteSessionWithDb,
} from '@/lib/stores/recording-actions';
import { createAction, createSession } from '../../fixtures';

// Mock chrome.runtime.sendMessage for syncFromBackground
const mockSendMessage = vi.fn();
vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
    lastError: null,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
});

describe('recording-actions', () => {
  beforeEach(async () => {
    recordingStore.getState().reset();
    await db.actions.clear();
    await db.sessions.clear();
    mockSendMessage.mockReset();
  });

  it('updateActionWithDb updates DB and store', async () => {
    const action = createAction({ id: 'a1', description: 'old' });
    await db.actions.add(action);
    recordingStore.getState().setActions([action]);

    await updateActionWithDb('a1', { description: 'updated' });

    // Store updated
    expect(recordingStore.getState().actions[0].description).toBe('updated');
    // DB updated
    const dbAction = await db.actions.get('a1');
    expect(dbAction?.description).toBe('updated');
  });

  it('deleteActionWithDb removes from DB and store, clears selection', async () => {
    const action = createAction({ id: 'a1' });
    await db.actions.add(action);
    recordingStore.getState().setActions([action]);
    recordingStore.getState().selectAction('a1');

    await deleteActionWithDb('a1');

    expect(recordingStore.getState().actions).toHaveLength(0);
    expect(recordingStore.getState().selectedActionId).toBeNull();
    expect(recordingStore.getState().view).toBe('list');
    const dbAction = await db.actions.get('a1');
    expect(dbAction).toBeUndefined();
  });

  it('reorderActionsWithDb reorders and persists', async () => {
    const a1 = createAction({ id: 'a1', sessionId: 's1', sequenceNumber: 1 });
    const a2 = createAction({ id: 'a2', sessionId: 's1', sequenceNumber: 2 });
    const a3 = createAction({ id: 'a3', sessionId: 's1', sequenceNumber: 3 });
    await db.actions.bulkAdd([a1, a2, a3]);
    recordingStore.getState().setActions([a1, a2, a3]);

    await reorderActionsWithDb('s1', 2, 0); // move a3 to front

    const storeActions = recordingStore.getState().actions;
    expect(storeActions[0].id).toBe('a3');
    expect(storeActions[0].sequenceNumber).toBe(1);
    expect(storeActions[1].id).toBe('a1');
    expect(storeActions[1].sequenceNumber).toBe(2);
    expect(storeActions[2].id).toBe('a2');
    expect(storeActions[2].sequenceNumber).toBe(3);

    // DB persisted
    const dbA3 = await db.actions.get('a3');
    expect(dbA3?.sequenceNumber).toBe(1);
  });

  it('handleStatusUpdate with sessionId loads session and actions', async () => {
    const session = createSession({ id: 's1' });
    const action = createAction({ id: 'a1', sessionId: 's1' });
    await db.sessions.add(session);
    await db.actions.add(action);

    await handleStatusUpdate({ status: 'recording', sessionId: 's1', actionCount: 1 });

    expect(recordingStore.getState().status).toBe('recording');
    expect(recordingStore.getState().session?.id).toBe('s1');
    expect(recordingStore.getState().actions).toHaveLength(1);
  });

  it('handleStatusUpdate without sessionId loads sessions when idle', async () => {
    const s1 = createSession({ id: 's1', status: 'stopped' });
    await db.sessions.add(s1);

    await handleStatusUpdate({ status: 'idle', actionCount: 0 });

    expect(recordingStore.getState().status).toBe('idle');
    expect(recordingStore.getState().sessions).toHaveLength(1);
    expect(recordingStore.getState().sessions[0].id).toBe('s1');
    expect(recordingStore.getState().view).toBe('sessions');
  });

  it('syncFromBackground sends GET_STATUS and populates store', async () => {
    const session = createSession({ id: 's1' });
    const action = createAction({ id: 'a1', sessionId: 's1' });
    await db.sessions.add(session);
    await db.actions.add(action);

    mockSendMessage.mockImplementation((_msg, callback) => {
      callback({ status: 'recording', sessionId: 's1', actionCount: 1 });
    });

    await syncFromBackground();

    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_STATUS' }, expect.any(Function));
    expect(recordingStore.getState().status).toBe('recording');
    expect(recordingStore.getState().session?.id).toBe('s1');
    expect(recordingStore.getState().actions).toHaveLength(1);
    expect(recordingStore.getState().view).toBe('list');
  });

  it('syncFromBackground shows sessions view when idle (no sessionId)', async () => {
    const s1 = createSession({ id: 's1', status: 'stopped' });
    await db.sessions.add(s1);

    mockSendMessage.mockImplementation((_msg, callback) => {
      callback({ status: 'idle', actionCount: 0 });
    });

    await syncFromBackground();

    expect(recordingStore.getState().status).toBe('idle');
    expect(recordingStore.getState().view).toBe('sessions');
    expect(recordingStore.getState().sessions).toHaveLength(1);
  });

  it('loadSessions populates sessions from DB', async () => {
    const s1 = createSession({ id: 's1', startedAt: 2000 });
    const s2 = createSession({ id: 's2', startedAt: 1000 });
    await db.sessions.bulkAdd([s1, s2]);

    await loadSessions();

    expect(recordingStore.getState().sessions).toHaveLength(2);
  });

  it('loadSessionActions loads actions and selects session', async () => {
    const session = createSession({ id: 's1' });
    const action = createAction({ id: 'a1', sessionId: 's1' });
    await db.sessions.add(session);
    await db.actions.add(action);

    await loadSessionActions(session);

    expect(recordingStore.getState().session?.id).toBe('s1');
    expect(recordingStore.getState().actions).toHaveLength(1);
    expect(recordingStore.getState().view).toBe('list');
  });

  it('renameSessionWithDb updates DB and store', async () => {
    const session = createSession({ id: 's1', name: 'Old Name' });
    await db.sessions.add(session);
    recordingStore.getState().setSessions([session]);
    recordingStore.getState().setSession(session);

    await renameSessionWithDb('s1', 'New Name');

    expect(recordingStore.getState().sessions[0].name).toBe('New Name');
    expect(recordingStore.getState().session?.name).toBe('New Name');
    const dbSession = await db.sessions.get('s1');
    expect(dbSession?.name).toBe('New Name');
  });

  it('deleteSessionWithDb removes from DB and store', async () => {
    const s1 = createSession({ id: 's1' });
    const s2 = createSession({ id: 's2' });
    await db.sessions.bulkAdd([s1, s2]);
    recordingStore.getState().setSessions([s1, s2]);
    recordingStore.getState().setSession(s2);

    await deleteSessionWithDb('s1');

    expect(recordingStore.getState().sessions).toHaveLength(1);
    expect(recordingStore.getState().sessions[0].id).toBe('s2');
    expect(recordingStore.getState().session?.id).toBe('s2');
    const dbSession = await db.sessions.get('s1');
    expect(dbSession).toBeUndefined();
  });

  it('deleteSessionWithDb navigates back if deleting current session', async () => {
    const session = createSession({ id: 's1' });
    await db.sessions.add(session);
    recordingStore.getState().setSessions([session]);
    recordingStore.getState().setSession(session);

    await deleteSessionWithDb('s1');

    expect(recordingStore.getState().sessions).toHaveLength(0);
    expect(recordingStore.getState().session).toBeNull();
    expect(recordingStore.getState().view).toBe('sessions');
  });
});
