import type {
  EnrichmentProvider,
  EnrichmentCapabilities,
  ValidationProvider,
} from './enrichment-provider';
import type { EnrichedAction } from './backend-client';
import type { CapturedAction, ValidationResult } from '../types';
import { processActionWithBackend, validateRecordingWithBackend } from './backend-client';

export class AdkBackendProvider implements EnrichmentProvider, ValidationProvider {
  readonly name = 'adk-backend';
  readonly capabilities: EnrichmentCapabilities = {
    visualGrounding: true,
    docValidation: true,
    complexAnalysis: true,
  };

  constructor(
    private backendUrl: string,
    private apiKey?: string,
  ) {}

  async enrichAction(
    action: CapturedAction,
    screenshotDataUrl: string,
    prevScreenshotDataUrl?: string,
  ): Promise<EnrichedAction | null> {
    return processActionWithBackend(
      action,
      screenshotDataUrl,
      this.backendUrl,
      this.apiKey,
      prevScreenshotDataUrl,
    );
  }

  async validateRecording(
    session: { name: string; url: string; startedAt: number; stoppedAt?: number },
    actions: CapturedAction[],
  ): Promise<ValidationResult | null> {
    // Adapt the minimal session shape to RecordingSession by providing required defaults.
    // validateRecordingWithBackend only reads: name, url, startedAt, stoppedAt, id, and actionCount,
    // so these defaults are safe.
    const fullSession = {
      id: `validation_${Date.now()}`,
      name: session.name,
      startedAt: session.startedAt,
      stoppedAt: session.stoppedAt,
      status: 'stopped' as const,
      url: session.url,
      actionCount: actions.length,
    };

    return validateRecordingWithBackend(fullSession, actions, this.backendUrl, this.apiKey);
  }
}
