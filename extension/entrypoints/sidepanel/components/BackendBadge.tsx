import { useBackendConfig } from '@/lib/hooks/use-backend-config';

export function BackendBadge() {
  const { isConfigured, loading } = useBackendConfig();

  if (loading) return null;

  const title = isConfigured ? 'AI analysis active' : 'AI analysis not configured — go to Settings';

  const color = isConfigured ? 'bg-green-500' : 'bg-gray-400';

  return <span class={`w-1.5 h-1.5 rounded-full ${color}`} title={title} />;
}
