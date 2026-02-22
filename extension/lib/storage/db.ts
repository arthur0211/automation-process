import Dexie, { type EntityTable } from 'dexie';
import type { CapturedAction, RecordingSession } from '../types';

// ─── Database Schema ────────────────────────────────────────────────────────

interface VideoBlob {
  id: string;
  sessionId: string;
  blob: Blob;
  createdAt: number;
}

const db = new Dexie('AgenticAutomationDB') as Dexie & {
  sessions: EntityTable<RecordingSession, 'id'>;
  actions: EntityTable<CapturedAction, 'id'>;
  videoBlobs: EntityTable<VideoBlob, 'id'>;
};

db.version(1).stores({
  sessions: 'id, status, startedAt',
  actions: 'id, sessionId, sequenceNumber, timestamp, [sessionId+sequenceNumber]',
  videoBlobs: 'id, sessionId',
});

export { db };
export type { VideoBlob };

// ─── Session Operations ─────────────────────────────────────────────────────

export async function createSession(session: RecordingSession): Promise<string> {
  return db.sessions.add(session);
}

export async function getSession(id: string): Promise<RecordingSession | undefined> {
  return db.sessions.get(id);
}

export async function updateSession(
  id: string,
  changes: Partial<RecordingSession>,
): Promise<void> {
  await db.sessions.update(id, changes);
}

export async function getAllSessions(): Promise<RecordingSession[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray();
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.actions, db.videoBlobs], async () => {
    await db.actions.where('sessionId').equals(id).delete();
    await db.videoBlobs.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

// ─── Action Operations ──────────────────────────────────────────────────────

export async function addAction(action: CapturedAction): Promise<string> {
  return db.actions.add(action);
}

export async function getAction(id: string): Promise<CapturedAction | undefined> {
  return db.actions.get(id);
}

export async function updateAction(
  id: string,
  changes: Partial<CapturedAction>,
): Promise<void> {
  await db.actions.update(id, changes);
}

export async function getSessionActions(sessionId: string): Promise<CapturedAction[]> {
  return db.actions
    .where('[sessionId+sequenceNumber]')
    .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
    .toArray();
}

export async function reorderActions(
  sessionId: string,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.actions, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.actions.update(orderedIds[i], { sequenceNumber: i + 1 });
    }
  });
}

export async function deleteAction(id: string): Promise<void> {
  await db.actions.delete(id);
}

// ─── Video Operations ───────────────────────────────────────────────────────

export async function saveVideoBlob(
  sessionId: string,
  blob: Blob,
): Promise<string> {
  const id = `video_${sessionId}`;
  await db.videoBlobs.put({ id, sessionId, blob, createdAt: Date.now() });
  return id;
}

export async function getVideoBlob(sessionId: string): Promise<Blob | undefined> {
  const record = await db.videoBlobs.get(`video_${sessionId}`);
  return record?.blob;
}

// ─── Utility ────────────────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.sessions, db.actions, db.videoBlobs], async () => {
    await db.sessions.clear();
    await db.actions.clear();
    await db.videoBlobs.clear();
  });
}

export async function getStorageUsage(): Promise<{ sessions: number; actions: number; videos: number }> {
  const [sessions, actions, videos] = await Promise.all([
    db.sessions.count(),
    db.actions.count(),
    db.videoBlobs.count(),
  ]);
  return { sessions, actions, videos };
}
