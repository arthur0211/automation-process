import type { ProcessExport, RecordingSession, CapturedAction } from '../types';
import { createSession, addAction } from '../storage/db';
import { createElementMetadata, createDecisionPoint } from './import-defaults';

export interface ImportResult {
  session: RecordingSession;
  actionCount: number;
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export function validateExport(data: unknown): ProcessExport {
  if (!data || typeof data !== 'object') {
    throw new ImportError('Invalid JSON: not an object');
  }

  const obj = data as Record<string, unknown>;

  if (obj.version !== '1.0.0') {
    throw new ImportError(`Unsupported version: ${String(obj.version)}`);
  }

  if (!obj.metadata || typeof obj.metadata !== 'object') {
    throw new ImportError('Missing or invalid metadata');
  }

  if (!Array.isArray(obj.steps)) {
    throw new ImportError('Missing or invalid steps array');
  }

  const meta = obj.metadata as Record<string, unknown>;
  if (typeof meta.name !== 'string' || !meta.name) {
    throw new ImportError('Missing metadata.name');
  }
  if (typeof meta.createdAt !== 'string') {
    throw new ImportError('Missing metadata.createdAt');
  }
  if (typeof meta.startUrl !== 'string') {
    throw new ImportError('Missing metadata.startUrl');
  }

  return data as ProcessExport;
}

export async function importFromJson(jsonString: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new ImportError('Invalid JSON format');
  }

  const data = validateExport(parsed);

  const sessionId = `imported_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date(data.metadata.createdAt).getTime() || Date.now();

  const session: RecordingSession = {
    id: sessionId,
    name: data.metadata.name,
    startedAt,
    stoppedAt: startedAt + (data.metadata.duration || 0),
    status: 'stopped',
    url: data.metadata.startUrl,
    actionCount: data.steps.length,
    ...(data.metadata.validation && { validationResult: data.metadata.validation }),
  };

  await createSession(session);

  for (const step of data.steps) {
    const action: CapturedAction = {
      id: `${sessionId}_step_${step.stepNumber}`,
      sessionId,
      timestamp: step.timestamp || startedAt + step.stepNumber * 1000,
      sequenceNumber: step.stepNumber,
      actionType: step.actionType,
      url: step.url,
      pageTitle: step.pageTitle,
      element: step.element || createElementMetadata(),
      description: step.description,
      note: step.note || '',
      screenshotDataUrl: step.screenshotDataUrl,
      decisionPoint: step.decisionPoint || createDecisionPoint(),
    };
    await addAction(action);
  }

  return { session, actionCount: data.steps.length };
}
