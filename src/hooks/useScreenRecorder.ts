import { useState, useRef, useEffect } from "react";

type UseScreenRecorderReturn = {
  recording: boolean;
  toggleRecording: () => void;
};

export function useScreenRecorder(): UseScreenRecorderReturn {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const selectedSource = await window.electronAPI.getSelectedSource();
      
      if (!selectedSource) {
        alert("Please select a source to record");
        return;
      }

      await window.electronAPI.startMouseTracking();

      const stream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: selectedSource.id,
          },
        },
      });
      streamRef.current = stream;
      
      if (!streamRef.current) {
        throw new Error("Failed to get media stream");
      }
      
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const width = settings.width || 1920;
      const height = settings.height || 1080;
      const totalPixels = width * height;
      
      let bitrate: number;
      if (totalPixels <= 1920 * 1080) {
        bitrate = 150_000_000; // 150 Mbps for 1080p
      } else if (totalPixels <= 2560 * 1440) {
        bitrate = 250_000_000; // 250 Mbps for 1440p
      } else {
        bitrate = 400_000_000; // 400 Mbps for 4K
      }
      
      console.log(`Recording at ${width}x${height} with bitrate: ${bitrate / 1_000_000} Mbps`);
      
      chunksRef.current = [];
      const mimeType = "video/webm;codecs=vp9";
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: bitrate,
      });
      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        // Don't stop stream here - already stopped in stopRecording for immediate indicator removal
        // Just cleanup the ref
        streamRef.current = null;
        
        if (chunksRef.current.length === 0) return;
        
        const videoBlob = new Blob(chunksRef.current, { type: mimeType });
        const timestamp = Date.now();
        const videoFileName = `recording-${timestamp}.webm`;
        const trackingFileName = `recording-${timestamp}_tracking.json`;
        
        try {
          const arrayBuffer = await videoBlob.arrayBuffer();
          
          console.log(`Saving video: ${videoFileName} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
          
          const videoResult = await window.electronAPI.storeRecordedVideo(
            arrayBuffer,
            videoFileName
          );
          
          if (videoResult.success) {
            console.log('✅ Video stored:', videoResult.path);
          } else {
            console.error('❌ Failed to store video:', videoResult.message);
          }
          
          const trackingResult = await window.electronAPI.storeMouseTrackingData(trackingFileName);
          
          if (trackingResult.success) {
            console.log('Mouse tracking stored:', trackingResult.path);
            console.log(`Captured ${trackingResult.eventCount} mouse events`);
          } else {
            console.warn('Failed to store tracking:', trackingResult.message);
          }
          
          console.log('Opening editor window...');
          await window.electronAPI.switchToEditor();
          
        } catch (error) {
          console.error('Error saving recording:', error);
        }
      };
      
      recorder.onerror = () => {
        setRecording(false);
      };
      
      recorder.start(1000);
      setRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      // Stop stream tracks IMMEDIATELY to remove macOS status indicator
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      
      mediaRecorderRef.current.stop();
      setRecording(false);
      
      window.electronAPI.stopMouseTracking();
    }
  };

  const toggleRecording = () => {
    if (!recording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  return { recording, toggleRecording };
}
