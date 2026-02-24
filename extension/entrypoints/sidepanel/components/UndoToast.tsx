import { useState, useEffect, useRef } from 'preact/hooks';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function UndoToast({ message, onUndo, onDismiss, duration = 5000 }: UndoToastProps) {
  const [remaining, setRemaining] = useState(duration);
  const startRef = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = Date.now();

    function tick() {
      const elapsed = Date.now() - startRef.current;
      const left = duration - elapsed;
      if (left <= 0) {
        onDismiss();
        return;
      }
      setRemaining(left);
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [duration, onDismiss]);

  const seconds = Math.ceil(remaining / 1000);

  return (
    <div class="fixed bottom-3 left-3 right-3 z-50 flex items-center gap-3 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
      <span class="flex-1 truncate">
        {message} ({seconds}s)
      </span>
      <button
        onClick={onUndo}
        class="flex-shrink-0 px-3 py-1 text-xs font-semibold text-blue-400 bg-blue-900/40 rounded hover:bg-blue-800/60 transition-colors"
      >
        Undo
      </button>
    </div>
  );
}
