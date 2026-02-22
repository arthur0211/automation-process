import { useState, useEffect } from 'preact/hooks';

interface Settings {
  screenshotQuality: number;
  scrollThrottleMs: number;
  inputDebounceMs: number;
}

const DEFAULT_SETTINGS: Settings = {
  screenshotQuality: 80,
  scrollThrottleMs: 1000,
  inputDebounceMs: 500,
};

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
      }
    });
  }, []);

  function handleChange(key: keyof Settings, value: number) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    chrome.storage.local.set({ settings }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function handleClearData() {
    if (confirm('This will delete all recorded sessions and data. Continue?')) {
      import('@/lib/storage/db').then(({ clearAllData }) => {
        clearAllData().then(() => alert('All data cleared.'));
      });
    }
  }

  return (
    <div class="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 class="text-xl font-bold text-gray-900">Settings</h1>
        <p class="mt-1 text-sm text-gray-500">
          Configure Agentic Automation Recorder
        </p>
      </div>

      <div class="space-y-4 bg-white p-5 rounded-lg shadow-sm">
        <h2 class="text-sm font-semibold text-gray-700">Capture Settings</h2>

        <div>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Screenshot Quality</span>
            <span class="text-sm text-gray-400">{settings.screenshotQuality}%</span>
          </label>
          <input
            type="range"
            min="40"
            max="100"
            step="10"
            value={settings.screenshotQuality}
            onInput={(e) =>
              handleChange('screenshotQuality', Number((e.target as HTMLInputElement).value))
            }
            class="w-full mt-1"
          />
        </div>

        <div>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Scroll Throttle</span>
            <span class="text-sm text-gray-400">{settings.scrollThrottleMs}ms</span>
          </label>
          <input
            type="range"
            min="500"
            max="3000"
            step="500"
            value={settings.scrollThrottleMs}
            onInput={(e) =>
              handleChange('scrollThrottleMs', Number((e.target as HTMLInputElement).value))
            }
            class="w-full mt-1"
          />
        </div>

        <div>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Input Debounce</span>
            <span class="text-sm text-gray-400">{settings.inputDebounceMs}ms</span>
          </label>
          <input
            type="range"
            min="200"
            max="2000"
            step="100"
            value={settings.inputDebounceMs}
            onInput={(e) =>
              handleChange('inputDebounceMs', Number((e.target as HTMLInputElement).value))
            }
            class="w-full mt-1"
          />
        </div>

        <button
          onClick={handleSave}
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      <div class="space-y-4 bg-white p-5 rounded-lg shadow-sm">
        <h2 class="text-sm font-semibold text-gray-700">Keyboard Shortcuts</h2>
        <div class="grid grid-cols-[1fr_auto] gap-2 text-sm">
          <span class="text-gray-600">Start Recording</span>
          <kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">Ctrl+Shift+R</kbd>
          <span class="text-gray-600">Pause/Resume</span>
          <kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">Ctrl+Shift+P</kbd>
          <span class="text-gray-600">Stop Recording</span>
          <kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">Ctrl+Shift+S</kbd>
        </div>
      </div>

      <div class="space-y-4 bg-white p-5 rounded-lg shadow-sm">
        <h2 class="text-sm font-semibold text-gray-700">Data Management</h2>
        <button
          onClick={handleClearData}
          class="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
        >
          Clear All Data
        </button>
      </div>
    </div>
  );
}
