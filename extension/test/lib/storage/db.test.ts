import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  updateSession,
  getAllSessions,
  deleteSession,
  addAction,
  getAction,
  getSessionActions,
  reorderActions,
  clearAllData,
  getStorageUsage,
  saveVideoBlob,
  getVideoBlob,
} from '@/lib/storage/db';
import { createAction, createSession as createSessionFixture } from '../../fixtures';

describe('db storage', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  // ─── Session operations ─────────────────────────────────────────────────────

  describe('sessions', () => {
    it('createSession + getSession round-trip', async () => {
      const session = createSessionFixture({ id: 'ses-1', name: 'My Session' });
      await createSession(session);
      const retrieved = await getSession('ses-1');
      expect(retrieved).toEqual(session);
    });

    it('getSession returns undefined for non-existent id', async () => {
      const result = await getSession('non-existent');
      expect(result).toBeUndefined();
    });

    it('getAllSessions returns sessions ordered by startedAt desc', async () => {
      await createSession(createSessionFixture({ id: 's1', startedAt: 1000 }));
      await createSession(createSessionFixture({ id: 's2', startedAt: 3000 }));
      await createSession(createSessionFixture({ id: 's3', startedAt: 2000 }));

      const sessions = await getAllSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions[0].id).toBe('s2');
      expect(sessions[1].id).toBe('s3');
      expect(sessions[2].id).toBe('s1');
    });

    it('updateSession applies partial update', async () => {
      await createSession(createSessionFixture({ id: 's1', name: 'Original' }));
      await updateSession('s1', { name: 'Updated', stoppedAt: 9999 });

      const session = await getSession('s1');
      expect(session?.name).toBe('Updated');
      expect(session?.stoppedAt).toBe(9999);
      expect(session?.url).toBe('https://example.com'); // unchanged
    });

    it('deleteSession cascades to actions and videoBlobs', async () => {
      await createSession(createSessionFixture({ id: 's1' }));
      await addAction(createAction({ id: 'a1', sessionId: 's1' }));
      await addAction(createAction({ id: 'a2', sessionId: 's1' }));
      await saveVideoBlob('s1', new Blob(['video']));

      await deleteSession('s1');

      expect(await getSession('s1')).toBeUndefined();
      expect(await getAction('a1')).toBeUndefined();
      expect(await getAction('a2')).toBeUndefined();
      expect(await getVideoBlob('s1')).toBeUndefined();
    });
  });

  // ─── Action operations ──────────────────────────────────────────────────────

  describe('actions', () => {
    it('addAction + getAction round-trip', async () => {
      const action = createAction({ id: 'act-1' });
      await addAction(action);
      const retrieved = await getAction('act-1');
      expect(retrieved).toEqual(action);
    });

    it('getSessionActions returns actions sorted by compound index', async () => {
      await addAction(createAction({ id: 'a3', sessionId: 's1', sequenceNumber: 3 }));
      await addAction(createAction({ id: 'a1', sessionId: 's1', sequenceNumber: 1 }));
      await addAction(createAction({ id: 'a2', sessionId: 's1', sequenceNumber: 2 }));
      // Different session
      await addAction(createAction({ id: 'a4', sessionId: 's2', sequenceNumber: 1 }));

      const actions = await getSessionActions('s1');
      expect(actions).toHaveLength(3);
      expect(actions[0].id).toBe('a1');
      expect(actions[1].id).toBe('a2');
      expect(actions[2].id).toBe('a3');
    });

    it('reorderActions re-numbers sequenceNumbers', async () => {
      await addAction(createAction({ id: 'a1', sessionId: 's1', sequenceNumber: 1 }));
      await addAction(createAction({ id: 'a2', sessionId: 's1', sequenceNumber: 2 }));
      await addAction(createAction({ id: 'a3', sessionId: 's1', sequenceNumber: 3 }));

      await reorderActions('s1', ['a3', 'a1', 'a2']);

      const a1 = await getAction('a1');
      const a2 = await getAction('a2');
      const a3 = await getAction('a3');
      expect(a3?.sequenceNumber).toBe(1);
      expect(a1?.sequenceNumber).toBe(2);
      expect(a2?.sequenceNumber).toBe(3);
    });
  });

  // ─── Video operations ───────────────────────────────────────────────────────

  describe('videos', () => {
    it('saveVideoBlob + getVideoBlob round-trip', async () => {
      const blob = new Blob(['test video content'], { type: 'video/webm' });
      await saveVideoBlob('s1', blob);

      const retrieved = await getVideoBlob('s1');
      expect(retrieved).toBeDefined();
      // fake-indexeddb may not preserve Blob prototype, check type property instead
      expect(retrieved!.type).toBe('video/webm');
    });

    it('getVideoBlob returns undefined for non-existent session', async () => {
      const result = await getVideoBlob('non-existent');
      expect(result).toBeUndefined();
    });
  });

  // ─── Utility operations ─────────────────────────────────────────────────────

  describe('utilities', () => {
    it('clearAllData empties all tables', async () => {
      await createSession(createSessionFixture({ id: 's1' }));
      await addAction(createAction({ id: 'a1', sessionId: 's1' }));
      await saveVideoBlob('s1', new Blob(['video']));

      await clearAllData();

      const usage = await getStorageUsage();
      expect(usage.sessions).toBe(0);
      expect(usage.actions).toBe(0);
      expect(usage.videos).toBe(0);
    });

    it('getStorageUsage returns correct counts', async () => {
      await createSession(createSessionFixture({ id: 's1' }));
      await createSession(createSessionFixture({ id: 's2' }));
      await addAction(createAction({ id: 'a1', sessionId: 's1' }));
      await addAction(createAction({ id: 'a2', sessionId: 's1' }));
      await addAction(createAction({ id: 'a3', sessionId: 's2' }));
      await saveVideoBlob('s1', new Blob(['video']));

      const usage = await getStorageUsage();
      expect(usage.sessions).toBe(2);
      expect(usage.actions).toBe(3);
      expect(usage.videos).toBe(1);
    });
  });
});
