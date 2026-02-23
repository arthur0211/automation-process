import { describe, it, expect, beforeEach } from 'vitest';
import { recordingStore } from '@/lib/stores/recording-store';

describe('recordingStore filter state', () => {
  beforeEach(() => {
    recordingStore.getState().reset();
  });

  it('starts with empty searchQuery and null filterType', () => {
    const state = recordingStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.filterType).toBeNull();
  });

  it('setSearchQuery updates searchQuery', () => {
    recordingStore.getState().setSearchQuery('login');
    expect(recordingStore.getState().searchQuery).toBe('login');
  });

  it('setSearchQuery can be cleared back to empty string', () => {
    recordingStore.getState().setSearchQuery('login');
    recordingStore.getState().setSearchQuery('');
    expect(recordingStore.getState().searchQuery).toBe('');
  });

  it('setFilterType updates filterType', () => {
    recordingStore.getState().setFilterType('click');
    expect(recordingStore.getState().filterType).toBe('click');
  });

  it('setFilterType accepts all action types', () => {
    const types = ['click', 'input', 'scroll', 'navigate', 'submit'] as const;
    for (const type of types) {
      recordingStore.getState().setFilterType(type);
      expect(recordingStore.getState().filterType).toBe(type);
    }
  });

  it('setFilterType can be cleared back to null', () => {
    recordingStore.getState().setFilterType('input');
    recordingStore.getState().setFilterType(null);
    expect(recordingStore.getState().filterType).toBeNull();
  });

  it('filter state persists across view changes', () => {
    recordingStore.getState().setSearchQuery('submit');
    recordingStore.getState().setFilterType('click');

    // Change view by selecting an action
    recordingStore.getState().selectAction('action-1');
    expect(recordingStore.getState().view).toBe('detail');
    expect(recordingStore.getState().searchQuery).toBe('submit');
    expect(recordingStore.getState().filterType).toBe('click');

    // Change view back to list
    recordingStore.getState().clearSelection();
    expect(recordingStore.getState().view).toBe('list');
    expect(recordingStore.getState().searchQuery).toBe('submit');
    expect(recordingStore.getState().filterType).toBe('click');
  });

  it('reset clears filter state', () => {
    recordingStore.getState().setSearchQuery('test');
    recordingStore.getState().setFilterType('navigate');

    recordingStore.getState().reset();

    const state = recordingStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.filterType).toBeNull();
  });
});
