import type { CapturedAction } from '../types';

// Backend integration placeholder for Phase 2 (ADK Backend)
// In Phase 1, all descriptions are template-based (no LLM calls)

interface EnrichedAction {
  humanDescription: string;
  visualAnalysis: Record<string, unknown>;
  decisionAnalysis: { isDecisionPoint: boolean; reason: string; branches: { condition: string; description: string }[] };
}

const BACKEND_URL = ''; // Will be configured in Phase 2

export async function processActionWithBackend(
  _action: CapturedAction,
  _screenshotDataUrl: string,
): Promise<EnrichedAction | null> {
  if (!BACKEND_URL) return null; // Phase 1: no backend, use template descriptions

  // Phase 2: This will send action + screenshot to ADK backend
  // const response = await fetch(`${BACKEND_URL}/api/process-action`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  //   body: JSON.stringify({ action, screenshotDataUrl }),
  // });
  // return response.json();

  return null;
}
