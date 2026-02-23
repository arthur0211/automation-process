import { describe, it, expect, beforeEach } from 'vitest';
import { recordingStore } from '@/lib/stores/recording-store';
import { createAction, createSession } from '../../fixtures';

describe('recordingStore', () => {
  beforeEach(() => {
    recordingStore.getState().reset();
  });

  it('starts with initial state', () => {
    const state = recordingStore.getState();
    expect(state.status).toBe('idle');
    expect(state.session).toBeNull();
    expect(state.sessions).toEqual([]);
    expect(state.actions).toEqual([]);
    expect(state.actionCount).toBe(0);
    expect(state.error).toBeNull();
    expect(state.selectedActionId).toBeNull();
    expect(state.view).toBe('sessions');
  });

  it('setStatus updates the status', () => {
    recordingStore.getState().setStatus('recording');
    expect(recordingStore.getState().status).toBe('recording');
  });

  it('setSession updates the session', () => {
    const session = createSession();
    recordingStore.getState().setSession(session);
    expect(recordingStore.getState().session).toEqual(session);
  });

  it('addAction appends action and increments count', () => {
    const action = createAction();
    recordingStore.getState().addAction(action);

    const state = recordingStore.getState();
    expect(state.actions).toHaveLength(1);
    expect(state.actions[0]).toEqual(action);
    expect(state.actionCount).toBe(1);
  });

  it('addAction accumulates multiple actions', () => {
    recordingStore.getState().addAction(createAction({ id: 'a1' }));
    recordingStore.getState().addAction(createAction({ id: 'a2' }));
    recordingStore.getState().addAction(createAction({ id: 'a3' }));

    expect(recordingStore.getState().actions).toHaveLength(3);
    expect(recordingStore.getState().actionCount).toBe(3);
  });

  it('removeAction removes action and decrements count', () => {
    recordingStore.getState().addAction(createAction({ id: 'a1' }));
    recordingStore.getState().addAction(createAction({ id: 'a2' }));
    recordingStore.getState().removeAction('a1');

    const state = recordingStore.getState();
    expect(state.actions).toHaveLength(1);
    expect(state.actions[0].id).toBe('a2');
    expect(state.actionCount).toBe(1);
  });

  it('updateAction merges partial changes', () => {
    recordingStore.getState().addAction(createAction({ id: 'a1', description: 'old' }));
    recordingStore.getState().updateAction('a1', { description: 'updated' });

    expect(recordingStore.getState().actions[0].description).toBe('updated');
    expect(recordingStore.getState().actions[0].id).toBe('a1');
  });

  it('reorderActions re-numbers sequenceNumbers', () => {
    recordingStore.getState().addAction(createAction({ id: 'a1', sequenceNumber: 1 }));
    recordingStore.getState().addAction(createAction({ id: 'a2', sequenceNumber: 2 }));
    recordingStore.getState().addAction(createAction({ id: 'a3', sequenceNumber: 3 }));

    recordingStore.getState().reorderActions(['a3', 'a1', 'a2']);

    const actions = recordingStore.getState().actions;
    expect(actions[0].id).toBe('a3');
    expect(actions[0].sequenceNumber).toBe(1);
    expect(actions[1].id).toBe('a1');
    expect(actions[1].sequenceNumber).toBe(2);
    expect(actions[2].id).toBe('a2');
    expect(actions[2].sequenceNumber).toBe(3);
  });

  it('setActions replaces actions list and updates count', () => {
    recordingStore.getState().addAction(createAction({ id: 'old' }));

    const newActions = [createAction({ id: 'n1' }), createAction({ id: 'n2' })];
    recordingStore.getState().setActions(newActions);

    const state = recordingStore.getState();
    expect(state.actions).toHaveLength(2);
    expect(state.actionCount).toBe(2);
    expect(state.actions[0].id).toBe('n1');
  });

  it('setError sets and clears error', () => {
    recordingStore.getState().setError('Something went wrong');
    expect(recordingStore.getState().error).toBe('Something went wrong');

    recordingStore.getState().setError(null);
    expect(recordingStore.getState().error).toBeNull();
  });

  it('reset restores initial state', () => {
    recordingStore.getState().setStatus('recording');
    recordingStore.getState().addAction(createAction());
    recordingStore.getState().setError('err');
    recordingStore.getState().selectAction('action-1');

    recordingStore.getState().reset();

    const state = recordingStore.getState();
    expect(state.status).toBe('idle');
    expect(state.session).toBeNull();
    expect(state.sessions).toEqual([]);
    expect(state.actions).toEqual([]);
    expect(state.actionCount).toBe(0);
    expect(state.error).toBeNull();
    expect(state.selectedActionId).toBeNull();
    expect(state.view).toBe('sessions');
  });

  it('setSessions updates sessions list', () => {
    const s1 = createSession({ id: 's1' });
    const s2 = createSession({ id: 's2' });
    recordingStore.getState().setSessions([s1, s2]);

    expect(recordingStore.getState().sessions).toHaveLength(2);
    expect(recordingStore.getState().sessions[0].id).toBe('s1');
  });

  it('selectSession sets session and view to list', () => {
    const session = createSession({ id: 's1' });
    recordingStore.getState().selectAction('some-action');
    recordingStore.getState().selectSession(session);

    const state = recordingStore.getState();
    expect(state.session?.id).toBe('s1');
    expect(state.view).toBe('list');
    expect(state.selectedActionId).toBeNull();
  });

  it('backToSessions clears and returns to sessions view', () => {
    const session = createSession({ id: 's1' });
    recordingStore.getState().setSession(session);
    recordingStore.getState().addAction(createAction());
    recordingStore.getState().selectAction('action-1');

    recordingStore.getState().backToSessions();

    const state = recordingStore.getState();
    expect(state.session).toBeNull();
    expect(state.actions).toEqual([]);
    expect(state.actionCount).toBe(0);
    expect(state.selectedActionId).toBeNull();
    expect(state.view).toBe('sessions');
  });

  it('selectAction sets selectedActionId and view to detail', () => {
    recordingStore.getState().selectAction('action-1');

    const state = recordingStore.getState();
    expect(state.selectedActionId).toBe('action-1');
    expect(state.view).toBe('detail');
  });

  it('clearSelection resets selectedActionId and view to list', () => {
    recordingStore.getState().selectAction('action-1');
    recordingStore.getState().clearSelection();

    const state = recordingStore.getState();
    expect(state.selectedActionId).toBeNull();
    expect(state.view).toBe('list');
  });
});
