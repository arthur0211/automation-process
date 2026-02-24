import { useState, useEffect } from 'preact/hooks';

interface BackendConfig {
  backendUrl: string | null;
  isConfigured: boolean;
  loading: boolean;
}

export function useBackendConfig(): BackendConfig {
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      chrome.storage.local.get(['backendUrl', 'backendApiKey'], (result) => {
        const url = result.backendUrl as string | undefined;
        setBackendUrl(url || null);
        setLoading(false);
      });

      const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
        if (area !== 'local') return;
        if (changes.backendUrl) {
          const url = changes.backendUrl.newValue as string | undefined;
          setBackendUrl(url || null);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    } catch {
      setLoading(false);
      return undefined;
    }
  }, []);

  return {
    backendUrl,
    isConfigured: Boolean(backendUrl),
    loading,
  };
}
