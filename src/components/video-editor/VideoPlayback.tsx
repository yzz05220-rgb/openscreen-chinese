import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

interface VideoPlaybackProps {
  videoPath: string;
  isSeeking: React.MutableRefObject<boolean>;
  onDurationChange: (duration: number) => void;
  onTimeUpdate: (time: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onError: (error: string) => void;
}

export interface VideoPlaybackRef {
  video: HTMLVideoElement | null;
}

const VideoPlayback = forwardRef<VideoPlaybackRef, VideoPlaybackProps>(({
  videoPath,
  isSeeking,
  onDurationChange,
  onTimeUpdate,
  onPlayStateChange,
  onError,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useImperativeHandle(ref, () => ({
    video: videoRef.current,
  }));

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animationId: number;
    function drawFrame() {
      if (!video || !canvas) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    }
    function drawFrameLoop() {
      if (!video || !canvas || video.paused || video.ended) return;
      drawFrame();
      animationId = requestAnimationFrame(drawFrameLoop);
    }
    const handlePlay = () => drawFrameLoop();
    const handlePause = () => cancelAnimationFrame(animationId);
    const handleSeeked = () => {
      drawFrame();
    };
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);
    video.addEventListener('seeked', handleSeeked);
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      cancelAnimationFrame(animationId);
    };
  }, [videoPath]);

  return (
    <div 
      className="w-full aspect-video rounded-xl p-8 flex items-center justify-center overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: 'url(/wallpaper.png)' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain rounded-lg"
      />
      <video
        ref={videoRef}
        src={videoPath}
        className="hidden"
        preload="metadata"
        onLoadedMetadata={e => {
          onDurationChange(e.currentTarget.duration);
        }}
        onDurationChange={e => {
          onDurationChange(e.currentTarget.duration);
        }}
        onTimeUpdate={e => {
          if (!isSeeking.current) onTimeUpdate(e.currentTarget.currentTime);
        }}
        onError={() => onError('Failed to load video')}
        onPlay={() => onPlayStateChange(true)}
        onPause={() => onPlayStateChange(false)}
        onEnded={() => onPlayStateChange(false)}
      />
    </div>
  );
});

VideoPlayback.displayName = 'VideoPlayback';

export default VideoPlayback;
