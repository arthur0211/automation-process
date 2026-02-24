import { useState, useEffect } from 'preact/hooks';
import { useBackendConfig } from '@/lib/hooks/use-backend-config';

const DISMISS_KEY = 'backend_setup_banner_dismissed';

export function BackendSetupBanner() {
  const { isConfigured, loading } = useBackendConfig();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      setDismissed(stored === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (loading || isConfigured || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // localStorage may be unavailable
    }
  }

  function handleOpenSettings() {
    try {
      chrome.runtime.openOptionsPage();
    } catch {
      // options page may not be available
    }
  }

  return (
    <div class="mx-3 mt-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
      <div class="flex items-start gap-2">
        <div class="flex-1 text-xs text-indigo-700">
          Configure AI analysis to enrich your recordings with intelligent descriptions.{' '}
          <button
            onClick={handleOpenSettings}
            class="font-medium text-indigo-600 hover:text-indigo-800 underline"
          >
            Settings
          </button>
        </div>
        <button
          onClick={handleDismiss}
          class="flex-shrink-0 text-indigo-400 hover:text-indigo-600 font-bold text-sm leading-none"
          aria-label="Dismiss banner"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
