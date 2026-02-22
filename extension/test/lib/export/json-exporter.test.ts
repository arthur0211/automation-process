import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToJson } from '@/lib/export/json-exporter';
import type { ProcessExport } from '@/lib/types';
import { createAction, createSession } from '../../fixtures';

describe('exportToJson', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns valid JSON with ProcessExport structure', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [createAction()];
    const result = JSON.parse(exportToJson(session, actions)) as ProcessExport;

    expect(result.version).toBe('1.0.0');
    expect(result.metadata).toBeDefined();
    expect(result.steps).toBeDefined();
    expect(Array.isArray(result.steps)).toBe(true);
  });

  it('sorts actions by sequenceNumber', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ id: 'a3', sequenceNumber: 3, description: 'Third' }),
      createAction({ id: 'a1', sequenceNumber: 1, description: 'First' }),
      createAction({ id: 'a2', sequenceNumber: 2, description: 'Second' }),
    ];
    const result = JSON.parse(exportToJson(session, actions)) as ProcessExport;

    expect(result.steps[0].description).toBe('First');
    expect(result.steps[1].description).toBe('Second');
    expect(result.steps[2].description).toBe('Third');
  });

  it('uses llmDescription over description when available', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ description: 'template desc', llmDescription: 'LLM enhanced desc' }),
    ];
    const result = JSON.parse(exportToJson(session, actions)) as ProcessExport;

    expect(result.steps[0].description).toBe('LLM enhanced desc');
  });

  it('falls back to description when llmDescription is absent', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [createAction({ description: 'template desc' })];
    const result = JSON.parse(exportToJson(session, actions)) as ProcessExport;

    expect(result.steps[0].description).toBe('template desc');
  });

  it('calculates metadata.totalSteps correctly', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ id: 'a1', sequenceNumber: 1 }),
      createAction({ id: 'a2', sequenceNumber: 2 }),
      createAction({ id: 'a3', sequenceNumber: 3 }),
    ];
    const result = JSON.parse(exportToJson(session, actions)) as ProcessExport;

    expect(result.metadata.totalSteps).toBe(3);
  });

  it('calculates duration from stoppedAt when available', () => {
    const session = createSession({
      startedAt: 1700000000000,
      stoppedAt: 1700000060000,
    });
    const result = JSON.parse(exportToJson(session, [])) as ProcessExport;

    expect(result.metadata.duration).toBe(60000);
  });

  it('uses Date.now() for duration when session has no stoppedAt', () => {
    const session = createSession({ startedAt: 1700000000000 });
    delete (session as Record<string, unknown>).stoppedAt;
    const result = JSON.parse(exportToJson(session, [])) as ProcessExport;

    // Date.now() is mocked to 2024-01-15T12:00:00Z = 1705320000000
    expect(result.metadata.duration).toBe(1705320000000 - 1700000000000);
  });

  it('maps stepNumber starting from 1', () => {
    const session = createSession({ stoppedAt: 1700000060000 });
    const actions = [
      createAction({ id: 'a1', sequenceNumber: 1 }),
      createAction({ id: 'a2', sequenceNumber: 2 }),
    ];
    const result = JSON.parse(exportToJson(session, actions)) as ProcessExport;

    expect(result.steps[0].stepNumber).toBe(1);
    expect(result.steps[1].stepNumber).toBe(2);
  });
});
