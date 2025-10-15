import { useEffect, useState } from "react";

export function VideoEditor() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVideo();
  }, []);

  const loadVideo = async () => {
    try {
      const result = await window.electronAPI.getRecordedVideoPath();
      
      if (result.success && result.path) {
        setVideoPath(`file://${result.path}`);
        console.log('Loading video from:', result.path);
      } else {
        setError(result.message || 'Failed to load video');
      }
    } catch (err) {
      setError('Error loading video: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

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
    <div className="flex flex-col h-screen bg-background p-6">
      <h1 className="text-2xl font-bold mb-4 text-foreground">Video Editor</h1>
      
      <div className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden">
        {videoPath && (
          <video
            src={videoPath}
            controls
            autoPlay
            className="max-w-full max-h-full"
            onError={(e) => {
              console.error('Video playback error:', e);
              setError('Failed to play video');
            }}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              console.log('Video loaded:', {
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight
              });
            }}
          />
        )}
      </div>
      
      <div className="mt-4 text-sm text-muted-foreground">
        Video path: {videoPath}
      </div>
    </div>
  );
}
