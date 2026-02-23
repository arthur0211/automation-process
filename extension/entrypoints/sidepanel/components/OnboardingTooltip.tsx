import { useState, useEffect } from 'preact/hooks';

interface OnboardingTooltipProps {
  storageKey: string;
  children: preact.ComponentChildren;
  onDismiss?: () => void;
}

export function OnboardingTooltip({ storageKey, children, onDismiss }: OnboardingTooltipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(storageKey, (result) => {
      if (!result[storageKey]) {
        setVisible(true);
      }
    });
  }, [storageKey]);

  function dismiss() {
    setVisible(false);
    chrome.storage.local.set({ [storageKey]: true });
    onDismiss?.();
  }

  if (!visible) return null;

  return (
    <div class="relative mx-3 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 shadow-sm">
      <div class="absolute -top-1.5 left-6 w-3 h-3 bg-blue-50 border-l border-t border-blue-200 rotate-45" />
      <div class="flex items-start gap-2">
        <div class="flex-1">{children}</div>
        <button
          onClick={dismiss}
          class="flex-shrink-0 text-blue-400 hover:text-blue-600 font-bold leading-none"
          aria-label="Dismiss tip"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
