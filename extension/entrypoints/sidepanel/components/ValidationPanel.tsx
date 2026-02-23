import type { RecordingSession } from '@/lib/types';

interface ValidationPanelProps {
  session: RecordingSession | null;
}

function scoreColor(score: number): string {
  if (score >= 7) return 'bg-green-500';
  if (score >= 4) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function ValidationPanel({ session }: ValidationPanelProps) {
  if (!session?.validationStatus) return null;

  if (session.validationStatus === 'running') {
    return (
      <div class="px-3 py-2 border-t border-gray-200 bg-white">
        <p class="text-xs text-gray-400 animate-pulse">Validating recording...</p>
      </div>
    );
  }

  if (session.validationStatus === 'error') {
    return (
      <div class="px-3 py-2 border-t border-gray-200 bg-white">
        <p class="text-xs text-red-400">Validation failed</p>
      </div>
    );
  }

  const result = session.validationResult;
  if (!result) return null;

  return (
    <div class="px-3 py-2 border-t border-gray-200 bg-white space-y-1.5">
      <div class="flex items-center gap-2">
        <span
          class={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${scoreColor(result.overallScore)}`}
        >
          {result.overallScore}
        </span>
        <label class="text-xs font-medium text-gray-500">Validation</label>
      </div>
      {result.summary && <p class="text-xs text-gray-600">{result.summary}</p>}
      {result.issues.length > 0 && (
        <div class="space-y-0.5">
          {result.issues.map((issue, i) => (
            <p key={i} class="text-xs text-red-500">
              Step {issue.step}: {issue.description}
            </p>
          ))}
        </div>
      )}
      {result.missingSteps.length > 0 && (
        <div class="space-y-0.5">
          {result.missingSteps.map((ms, i) => (
            <p key={i} class="text-xs text-yellow-600">
              After step {ms.afterStep}: {ms.description}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
