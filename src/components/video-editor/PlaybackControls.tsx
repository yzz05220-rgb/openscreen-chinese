import { Button } from "../ui/button";
import { MdPlayArrow, MdPause } from "react-icons/md";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlayPause: () => void;
  onSeek: (time: number) => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
}

export default function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onTogglePlayPause,
  onSeek,
  onSeekStart,
  onSeekEnd,
}: PlaybackControlsProps) {
  function formatTime(seconds: number) {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleSeekChange(e: React.ChangeEvent<HTMLInputElement>) {
    onSeek(parseFloat(e.target.value));
  }

  return (
    <div className="flex items-center gap-4 px-4">
      <Button
        onClick={onTogglePlayPause}
        size="icon"
        className="w-8 h-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-md"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <MdPause width={18} height={18} />
        ) : (
          <MdPlayArrow width={18} height={18} />
        )}
      </Button>
      <span className="text-xs text-muted-foreground font-mono">
        {formatTime(currentTime)}
      </span>
      <input
        type="range"
        min="0"
        max={duration}
        value={currentTime}
        onChange={handleSeekChange}
        onMouseDown={onSeekStart}
        onMouseUp={onSeekEnd}
        onTouchStart={onSeekStart}
        onTouchEnd={onSeekEnd}
        step="0.01"
        className="flex-1 h-2 accent-blue-500 rounded-full"
        style={{
    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`
  }}
      />
      <span className="text-xs text-muted-foreground font-mono">
        {formatTime(duration)}
      </span>
    </div>
  );
}
