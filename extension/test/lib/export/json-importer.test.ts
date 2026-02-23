import { describe, it, expect, beforeEach } from 'vitest';
import { validateExport, importFromJson, ImportError } from '@/lib/export/json-importer';
import { exportToJson } from '@/lib/export/json-exporter';
import { db } from '@/lib/storage/db';
import { createAction, createSession } from '../../fixtures';

describe('validateExport', () => {
  it('rejects non-object input', () => {
    expect(() => validateExport(null)).toThrow(ImportError);
    expect(() => validateExport('string')).toThrow(ImportError);
  });

  it('rejects unsupported version', () => {
    expect(() => validateExport({ version: '2.0.0', metadata: {}, steps: [] })).toThrow(
      'Unsupported version',
    );
  });

  it('rejects missing metadata', () => {
    expect(() => validateExport({ version: '1.0.0', steps: [] })).toThrow(
      'Missing or invalid metadata',
    );
  });

  it('rejects missing steps array', () => {
    expect(() =>
      validateExport({
        version: '1.0.0',
        metadata: { name: 'Test', createdAt: '2024-01-01', startUrl: 'https://example.com' },
      }),
    ).toThrow('Missing or invalid steps');
  });

  it('rejects missing metadata.name', () => {
    expect(() =>
      validateExport({
        version: '1.0.0',
        metadata: { createdAt: '2024-01-01', startUrl: 'https://example.com' },
        steps: [],
      }),
    ).toThrow('Missing metadata.name');
  });

  it('accepts valid ProcessExport', () => {
    const valid = {
      version: '1.0.0',
      metadata: {
        name: 'Test',
        createdAt: '2024-01-01T00:00:00Z',
        totalSteps: 0,
        startUrl: 'https://example.com',
        duration: 1000,
      },
      steps: [],
    };
    expect(() => validateExport(valid)).not.toThrow();
  });
});

describe('importFromJson', () => {
  beforeEach(async () => {
    await db.sessions.clear();
    await db.actions.clear();
  });

  it('rejects invalid JSON string', async () => {
    await expect(importFromJson('not json')).rejects.toThrow('Invalid JSON format');
  });

  it('rejects invalid schema', async () => {
    await expect(importFromJson('{"version":"9.0.0"}')).rejects.toThrow(ImportError);
  });

  it('imports a valid export and creates session + actions in DB', async () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ id: 'a1', sequenceNumber: 1, description: 'Step one' }),
      createAction({ id: 'a2', sequenceNumber: 2, description: 'Step two' }),
    ];
    const json = exportToJson(session, actions);

    const result = await importFromJson(json);

    expect(result.actionCount).toBe(2);
    expect(result.session.name).toBe('Test Session');
    expect(result.session.status).toBe('stopped');

    // Verify DB
    const dbSessions = await db.sessions.toArray();
    expect(dbSessions).toHaveLength(1);
    expect(dbSessions[0].id).toBe(result.session.id);

    const dbActions = await db.actions.toArray();
    expect(dbActions).toHaveLength(2);
    expect(dbActions[0].sessionId).toBe(result.session.id);
  });

  it('generates unique session IDs for each import', async () => {
    const json = JSON.stringify({
      version: '1.0.0',
      metadata: {
        name: 'Test',
        createdAt: '2024-01-01T00:00:00Z',
        totalSteps: 0,
        startUrl: 'https://example.com',
        duration: 0,
      },
      steps: [],
    });

    const r1 = await importFromJson(json);
    const r2 = await importFromJson(json);

    expect(r1.session.id).not.toBe(r2.session.id);
  });

  it('handles steps without element or decisionPoint gracefully', async () => {
    const json = JSON.stringify({
      version: '1.0.0',
      metadata: {
        name: 'Minimal',
        createdAt: '2024-01-01T00:00:00Z',
        totalSteps: 1,
        startUrl: 'https://example.com',
        duration: 0,
      },
      steps: [
        {
          stepNumber: 1,
          actionType: 'click',
          url: 'https://example.com',
          pageTitle: 'Test',
          description: 'Clicked something',
          note: '',
          timestamp: 1700000000000,
        },
      ],
    });

    const result = await importFromJson(json);
    expect(result.actionCount).toBe(1);

    const dbActions = await db.actions.toArray();
    expect(dbActions[0].element.tag).toBe('unknown');
    expect(dbActions[0].decisionPoint.isDecisionPoint).toBe(false);
  });

  it('preserves validation result from export', async () => {
    const json = JSON.stringify({
      version: '1.0.0',
      metadata: {
        name: 'Validated',
        createdAt: '2024-01-01T00:00:00Z',
        totalSteps: 0,
        startUrl: 'https://example.com',
        duration: 0,
        validation: {
          overallScore: 9,
          issues: [],
          suggestions: [],
          missingSteps: [],
          summary: 'Great',
        },
      },
      steps: [],
    });

    const result = await importFromJson(json);
    expect(result.session.validationResult?.overallScore).toBe(9);
  });
});
