import { useState, useEffect } from 'preact/hooks';

export type EnrichmentMode = 'backend' | 'gemini' | 'none';

interface BackendConfig {
  backendUrl: string | null;
  geminiApiKey: string | null;
  isConfigured: boolean;
  mode: EnrichmentMode;
  loading: boolean;
}

export function useBackendConfig(): BackendConfig {
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      chrome.storage.local.get(['backendUrl', 'geminiApiKey'], (result) => {
        setBackendUrl((result.backendUrl as string) || null);
        setGeminiApiKey((result.geminiApiKey as string) || null);
        setLoading(false);
      });

      const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
        if (area !== 'local') return;
        if (changes.backendUrl) {
          setBackendUrl((changes.backendUrl.newValue as string) || null);
        }
        if (changes.geminiApiKey) {
          setGeminiApiKey((changes.geminiApiKey.newValue as string) || null);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    } catch {
      setLoading(false);
      return undefined;
    }
  }, []);

  const mode: EnrichmentMode = backendUrl ? 'backend' : geminiApiKey ? 'gemini' : 'none';

  return {
    backendUrl,
    geminiApiKey,
    isConfigured: mode !== 'none',
    mode,
    loading,
  };
}
