import { useState, useEffect, useRef } from 'preact/hooks';
import { getVideoBlob } from '@/lib/storage/db';

interface VideoPlayerProps {
  sessionId: string;
}

export function VideoPlayer({ sessionId }: VideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let revoked = false;
    let url: string | null = null;

    getVideoBlob(sessionId).then((blob) => {
      if (revoked) return;
      setLoading(false);
      if (blob) {
        url = URL.createObjectURL(blob);
        setVideoUrl(url);
      }
    });

    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sessionId]);

  if (loading) return null;
  if (!videoUrl) return null;

  return (
    <div class="border-t border-gray-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        class="w-full px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <span class={`transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9654;</span>
        Video Recording
      </button>
      {expanded && (
        <div class="px-3 pb-3">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            class="w-full rounded border border-gray-200"
            style={{ maxHeight: '300px' }}
          />
        </div>
      )}
    </div>
  );
}

export function seekVideo(videoEl: HTMLVideoElement | null, timestampMs: number) {
  if (!videoEl) return;
  videoEl.currentTime = timestampMs / 1000;
  videoEl.play();
}
