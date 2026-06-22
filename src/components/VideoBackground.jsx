import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import './VideoBackground.css';

export default function VideoBackground({ src, poster, onReady, onError }) {
  const videoRef = useRef(null);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onReady, onError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls;
    let cancelled = false;

    const handleReady = () => {
      if (!cancelled) onReadyRef.current?.();
    };

    const handleError = () => {
      if (!cancelled) onErrorRef.current?.();
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadeddata', handleReady, { once: true });
      video.addEventListener('error', handleError, { once: true });
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, handleReady);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) handleError();
      });
    } else {
      video.src = src.replace('.m3u8', '.mp4');
      video.addEventListener('loadeddata', handleReady, { once: true });
      video.addEventListener('error', handleError, { once: true });
    }

    return () => {
      cancelled = true;
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('error', handleError);
      hls?.destroy();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="video-bg"
      autoPlay
      muted
      loop
      playsInline
      poster={poster}
      aria-hidden="true"
    />
  );
}
