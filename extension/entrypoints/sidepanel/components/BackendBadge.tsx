import { useBackendConfig } from '@/lib/hooks/use-backend-config';

export function BackendBadge() {
  const { isConfigured, mode, loading } = useBackendConfig();

  if (loading) return null;

  const titles: Record<string, string> = {
    backend: 'AI analysis active (ADK backend)',
    gemini: 'AI analysis active (Gemini API)',
    none: 'AI analysis not configured — go to Settings',
  };

  const colors: Record<string, string> = {
    backend: 'bg-green-500',
    gemini: 'bg-blue-500',
    none: 'bg-gray-400',
  };

  return (
    <span
      class={`w-1.5 h-1.5 rounded-full ${colors[mode] || 'bg-gray-400'}`}
      title={titles[mode] || ''}
    />
  );
}
