import type { CapturedAction, ValidationResult } from '../types';
import type { EnrichedAction } from './backend-client';

export interface EnrichmentCapabilities {
  visualGrounding: boolean;
  docValidation: boolean;
  complexAnalysis: boolean;
}

export interface EnrichmentProvider {
  readonly name: string;
  readonly capabilities: EnrichmentCapabilities;

  enrichAction(
    action: CapturedAction,
    screenshotDataUrl: string,
    prevScreenshotDataUrl?: string,
  ): Promise<EnrichedAction | null>;
}

export interface ValidationProvider {
  validateRecording(
    session: { name: string; url: string; startedAt: number; stoppedAt?: number },
    actions: CapturedAction[],
  ): Promise<ValidationResult | null>;
}

export async function getEnrichmentProvider(): Promise<EnrichmentProvider | null> {
  const config = await chrome.storage.local.get(['backendUrl', 'backendApiKey', 'geminiApiKey']);

  const backendUrl = config.backendUrl as string | undefined;
  const backendApiKey = config.backendApiKey as string | undefined;
  const geminiApiKey = config.geminiApiKey as string | undefined;

  // Priority: backend URL > Gemini API key > nothing
  if (backendUrl) {
    const { AdkBackendProvider } = await import('./backend-provider');
    return new AdkBackendProvider(backendUrl, backendApiKey);
  }

  if (geminiApiKey) {
    const { GeminiDirectProvider } = await import('./gemini-client');
    return new GeminiDirectProvider(geminiApiKey);
  }

  return null;
}
