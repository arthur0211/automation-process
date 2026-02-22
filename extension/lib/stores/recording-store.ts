import { createStore } from 'zustand/vanilla';
import { useSyncExternalStore } from 'preact/compat';
import type { RecordingStatus, CapturedAction, RecordingSession } from '../types';

export interface RecordingState {
  status: RecordingStatus;
  session: RecordingSession | null;
  actions: CapturedAction[];
  actionCount: number;
  error: string | null;
  selectedActionId: string | null;
  view: 'list' | 'detail';
}

export interface RecordingActions {
  setStatus: (status: RecordingStatus) => void;
  setSession: (session: RecordingSession | null) => void;
  addAction: (action: CapturedAction) => void;
  updateAction: (id: string, changes: Partial<CapturedAction>) => void;
  removeAction: (id: string) => void;
  reorderActions: (orderedIds: string[]) => void;
  setActions: (actions: CapturedAction[]) => void;
  setError: (error: string | null) => void;
  selectAction: (id: string) => void;
  clearSelection: () => void;
  reset: () => void;
}

const initialState: RecordingState = {
  status: 'idle',
  session: null,
  actions: [],
  actionCount: 0,
  error: null,
  selectedActionId: null,
  view: 'list',
};

export const recordingStore = createStore<RecordingState & RecordingActions>()((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),

  setSession: (session) => set({ session }),

  addAction: (action) =>
    set((state) => ({
      actions: [...state.actions, action],
      actionCount: state.actionCount + 1,
    })),

  updateAction: (id, changes) =>
    set((state) => ({
      actions: state.actions.map((a) => (a.id === id ? { ...a, ...changes } : a)),
    })),

  removeAction: (id) =>
    set((state) => ({
      actions: state.actions.filter((a) => a.id !== id),
      actionCount: state.actionCount - 1,
    })),

  reorderActions: (orderedIds) =>
    set((state) => {
      const actionMap = new Map(state.actions.map((a) => [a.id, a]));
      const reordered = orderedIds
        .map((id, index) => {
          const action = actionMap.get(id);
          if (!action) return null;
          return { ...action, sequenceNumber: index + 1 };
        })
        .filter(Boolean) as CapturedAction[];
      return { actions: reordered };
    }),

  setActions: (actions) => set({ actions, actionCount: actions.length }),

  setError: (error) => set({ error }),

  selectAction: (id) => set({ selectedActionId: id, view: 'detail' }),

  clearSelection: () => set({ selectedActionId: null, view: 'list' }),

  reset: () => set(initialState),
}));

type StoreState = RecordingState & RecordingActions;

export function useRecordingStore<U>(selector: (state: StoreState) => U): U {
  return useSyncExternalStore(
    recordingStore.subscribe,
    () => selector(recordingStore.getState()),
  );
}
