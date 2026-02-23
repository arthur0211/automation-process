import { useState, useEffect } from 'preact/hooks';
import type { CaptureSettings, BrandingSettings } from '@/lib/types';
import { DEFAULT_CAPTURE_SETTINGS, DEFAULT_BRANDING_SETTINGS } from '@/lib/types';

export function Options() {
  const [settings, setSettings] = useState<CaptureSettings>(DEFAULT_CAPTURE_SETTINGS);
  const [backendUrl, setBackendUrl] = useState('');
  const [backendApiKey, setBackendApiKey] = useState('');
  const [standaloneAgentsUrl, setStandaloneAgentsUrl] = useState('');
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [githubPat, setGithubPat] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(
      ['settings', 'backendUrl', 'backendApiKey', 'standaloneAgentsUrl', 'showThumbnails', 'brandingSettings', 'github_pat', 'github_repo'],
      (result) => {
        if (result.settings) {
          setSettings({ ...DEFAULT_CAPTURE_SETTINGS, ...result.settings });
        }
        if (result.backendUrl) {
          setBackendUrl(result.backendUrl as string);
        }
        if (result.backendApiKey) {
          setBackendApiKey(result.backendApiKey as string);
        }
        if (result.standaloneAgentsUrl) {
          setStandaloneAgentsUrl(result.standaloneAgentsUrl as string);
        }
        if (result.showThumbnails !== undefined) {
          setShowThumbnails(result.showThumbnails as boolean);
        }
        if (result.brandingSettings) {
          setBranding({ ...DEFAULT_BRANDING_SETTINGS, ...(result.brandingSettings as BrandingSettings) });
        }
        if (result.github_pat) {
          setGithubPat(result.github_pat as string);
        }
        if (result.github_repo) {
          setGithubRepo(result.github_repo as string);
        }
      },
    );
  }, []);

  function handleChange(key: keyof CaptureSettings, value: number) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    chrome.storage.local.set({ settings, backendUrl, backendApiKey, standaloneAgentsUrl, showThumbnails, brandingSettings: branding, github_pat: githubPat, github_repo: githubRepo }, () => {
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
        <p class="mt-1 text-sm text-gray-500">Configure Agentic Automation Recorder</p>
      </div>

      <div class="space-y-4 bg-white p-5 rounded-lg shadow-sm">
        <h2 class="text-sm font-semibold text-gray-700">Capture Settings</h2>

        <div>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-600">
              Screenshot Quality
              <span
                class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
                title="JPEG quality for captured screenshots. Lower values save storage but reduce clarity."
              >
                i
              </span>
            </span>
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
            <span class="text-sm text-gray-600">
              Scroll Throttle
              <span
                class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
                title="Minimum time between captured scroll events. Higher values reduce noise from fast scrolling."
              >
                i
              </span>
            </span>
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
            <span class="text-sm text-gray-600">
              Input Debounce
              <span
                class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
                title="Delay before capturing text input. Waits for the user to stop typing before recording the value."
              >
                i
              </span>
            </span>
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

        <div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showThumbnails}
              onChange={(e) => {
                setShowThumbnails((e.target as HTMLInputElement).checked);
                setSaved(false);
              }}
              class="rounded border-gray-300"
            />
            <span class="text-sm text-gray-600">
              Show screenshot thumbnails in step list
              <span
                class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
                title="Display small screenshot previews next to each recorded step. Disable to save space."
              >
                i
              </span>
            </span>
          </label>
        </div>

        <button
          onClick={handleSave}
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      <div class="space-y-4 bg-white p-5 rounded-lg shadow-sm">
        <h2 class="text-sm font-semibold text-gray-700">Export Branding</h2>
        <p class="text-xs text-gray-400">
          Customize the appearance of HTML exports with your brand colors and text.
        </p>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">
            Accent Color
            <span
              class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
              title="Primary color used for headers, step numbers, and links in HTML exports."
            >
              i
            </span>
          </label>
          <div class="flex items-center gap-2">
            <input
              type="color"
              value={branding.accentColor}
              onInput={(e) => {
                setBranding((prev) => ({ ...prev, accentColor: (e.target as HTMLInputElement).value }));
                setSaved(false);
              }}
              class="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={branding.accentColor}
              onInput={(e) => {
                setBranding((prev) => ({ ...prev, accentColor: (e.target as HTMLInputElement).value }));
                setSaved(false);
              }}
              class="w-28 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
              placeholder="#2563eb"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">
            Header Text
            <span
              class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
              title="Custom text displayed at the top of HTML exports, below the title."
            >
              i
            </span>
          </label>
          <input
            type="text"
            placeholder="e.g., Company Name - Internal Documentation"
            value={branding.headerText}
            onInput={(e) => {
              setBranding((prev) => ({ ...prev, headerText: (e.target as HTMLInputElement).value }));
              setSaved(false);
            }}
            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">
            Footer Text
            <span
              class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
              title="Custom text displayed at the bottom of HTML exports."
            >
              i
            </span>
          </label>
          <input
            type="text"
            placeholder="e.g., Confidential - Do not distribute"
            value={branding.footerText}
            onInput={(e) => {
              setBranding((prev) => ({ ...prev, footerText: (e.target as HTMLInputElement).value }));
              setSaved(false);
            }}
            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      <details class="bg-white rounded-lg shadow-sm">
        <summary class="px-5 py-4 text-sm font-semibold text-gray-700 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
          Advanced
        </summary>
        <div class="space-y-4 px-5 pb-5">
          <p class="text-xs text-gray-400">
            Connect to an ADK backend for LLM-powered enrichment. Leave empty for template-only
            mode.
          </p>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              Backend URL
              <span
                class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
                title="URL of the ADK coordinator agent. Used to enrich recordings with LLM-generated descriptions."
              >
                i
              </span>
            </label>
            <input
              type="url"
              placeholder="http://localhost:8000"
              value={backendUrl}
              onInput={(e) => {
                setBackendUrl((e.target as HTMLInputElement).value);
                setSaved(false);
              }}
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              API Key
              <span
                class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
                title="API key for authenticating with the ADK backend. Must match the API_KEY environment variable on the server."
              >
                i
              </span>
            </label>
            <input
              type="password"
              placeholder="your-api-key"
              value={backendApiKey}
              onInput={(e) => {
                setBackendApiKey((e.target as HTMLInputElement).value);
                setSaved(false);
              }}
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <p class="text-xs text-gray-400 mt-1">
              Shared between Backend URL and Standalone Agents URL. Leave empty if backend has no authentication.
            </p>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              Standalone Agents URL
              <span
                class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
                title="URL for standalone agents (doc_validator, complex_analyzer). Separate from the main pipeline."
              >
                i
              </span>
            </label>
            <input
              type="url"
              placeholder="http://localhost:8001"
              value={standaloneAgentsUrl}
              onInput={(e) => {
                setStandaloneAgentsUrl((e.target as HTMLInputElement).value);
                setSaved(false);
              }}
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <p class="text-xs text-gray-400 mt-1">
              For doc_validator and complex_analyzer agents. Leave empty to disable.
            </p>
          </div>
        </div>
      </details>

      <div class="space-y-4 bg-white p-5 rounded-lg shadow-sm">
        <h2 class="text-sm font-semibold text-gray-700">GitHub Integration</h2>
        <p class="text-xs text-gray-400">
          Configure a Personal Access Token to create GitHub Issues directly from recordings.
        </p>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">
            Personal Access Token
            <span
              class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
              title="GitHub PAT with 'repo' scope. Create one at github.com/settings/tokens."
            >
              i
            </span>
          </label>
          <input
            type="password"
            placeholder="ghp_..."
            value={githubPat}
            onInput={(e) => {
              setGithubPat((e.target as HTMLInputElement).value);
              setSaved(false);
            }}
            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">
            Default Repository
            <span
              class="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full cursor-help align-middle"
              title="Default repository for new issues. Can be overridden when creating an issue."
            >
              i
            </span>
          </label>
          <input
            type="text"
            placeholder="owner/repo"
            value={githubRepo}
            onInput={(e) => {
              setGithubRepo((e.target as HTMLInputElement).value);
              setSaved(false);
            }}
            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
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
