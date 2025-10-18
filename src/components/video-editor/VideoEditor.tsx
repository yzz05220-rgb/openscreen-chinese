

import { useEffect, useRef, useState } from "react";
import VideoPlayback, { VideoPlaybackRef } from "./VideoPlayback";
import PlaybackControls from "./PlaybackControls";
import TimelineEditor from "./TimelineEditor";
import SettingsPanel from "./SettingsPanel";

export default function VideoEditor() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoPlaybackRef = useRef<VideoPlaybackRef>(null);
  const isSeeking = useRef(false);

  useEffect(() => {
    async function loadVideo() {
      try {
        const result = await window.electronAPI.getRecordedVideoPath();
        if (result.success && result.path) {
          setVideoPath(`file://${result.path}`);
        } else {
          setError(result.message || 'Failed to load video');
        }
      } catch (err) {
        setError('Error loading video: ' + String(err));
      } finally {
        setLoading(false);
      }
    }
    loadVideo();
  }, []);

  function togglePlayPause() {
    const video = videoPlaybackRef.current?.video;
    if (!video) return;
    isPlaying ? video.pause() : video.play();
  }

  function handleSeek(time: number) {
    const video = videoPlaybackRef.current?.video;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }

  function handleSeekStart() {
    isSeeking.current = true;
  }

  function handleSeekEnd() {
    isSeeking.current = false;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-foreground">Loading video...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background p-8 gap-8">
      <div className="flex flex-col flex-[7] min-w-0 gap-8">
        <div className="flex flex-col gap-6 flex-1">
          {videoPath && (
            <>
              <VideoPlayback
                ref={videoPlaybackRef}
                videoPath={videoPath}
                isSeeking={isSeeking}
                onDurationChange={setDuration}
                onTimeUpdate={setCurrentTime}
                onPlayStateChange={setIsPlaying}
                onError={setError}
              />
              <PlaybackControls
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                onTogglePlayPause={togglePlayPause}
                onSeek={handleSeek}
                onSeekStart={handleSeekStart}
                onSeekEnd={handleSeekEnd}
              />
            </>
          )}
        </div>
        <TimelineEditor />
      </div>
      <SettingsPanel />
    </div>
  );
}