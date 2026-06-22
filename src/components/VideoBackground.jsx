import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import './VideoBackground.css';

export default function VideoBackground({ src, poster, onReady }) {
  const videoRef = useRef(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls;

    const handleReady = () => onReadyRef.current?.();

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadeddata', handleReady, { once: true });
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, handleReady);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn('HLS playback error:', data.type, data.details);
        }
      });
    } else {
      video.src = src.replace('.m3u8', '.mp4');
      video.addEventListener('loadeddata', handleReady, { once: true });
    }

    return () => {
      video.removeEventListener('loadeddata', handleReady);
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
