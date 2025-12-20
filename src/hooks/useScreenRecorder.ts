import { useState, useRef, useEffect } from "react";
import { fixWebmDuration } from "@fix-webm-duration/fix";

// 音频录制模式
export type AudioMode = 'none' | 'system' | 'mic' | 'both';

type UseScreenRecorderReturn = {
  recording: boolean;
  toggleRecording: () => void;
  audioMode: AudioMode;
  setAudioMode: (mode: AudioMode) => void;
};

export function useScreenRecorder(): UseScreenRecorderReturn {
  const [recording, setRecording] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>('none');
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef<number>(0);
  const audioModeRef = useRef(audioMode);

  // 同步 audioMode 状态到 ref
  useEffect(() => {
    audioModeRef.current = audioMode;
  }, [audioMode]);

  // Target visually lossless 4K @ 60fps; fall back gracefully when hardware cannot keep up
  const TARGET_FRAME_RATE = 60;
  const TARGET_WIDTH = 3840;
  const TARGET_HEIGHT = 2160;
  const FOUR_K_PIXELS = TARGET_WIDTH * TARGET_HEIGHT;
  const selectMimeType = () => {
    const preferred = [
      "video/webm;codecs=av1",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ];

    return preferred.find(type => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
  };

  const computeBitrate = (width: number, height: number) => {
    const pixels = width * height;
    const highFrameRateBoost = TARGET_FRAME_RATE >= 60 ? 1.7 : 1;

    if (pixels >= FOUR_K_PIXELS) {
      return Math.round(45_000_000 * highFrameRateBoost);
    }

    if (pixels >= 2560 * 1440) {
      return Math.round(28_000_000 * highFrameRateBoost);
    }

    return Math.round(18_000_000 * highFrameRateBoost);
  };

  const stopRecording = useRef(() => {
    if (mediaRecorder.current?.state === "recording") {
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
      }
      mediaRecorder.current.stop();
      setRecording(false);

      window.electronAPI?.setRecordingState(false);
    }
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    if (window.electronAPI?.onStopRecordingFromTray) {
      cleanup = window.electronAPI.onStopRecordingFromTray(() => {
        stopRecording.current();
      });
    }

    return () => {
      if (cleanup) cleanup();
      
      if (mediaRecorder.current?.state === "recording") {
        mediaRecorder.current.stop();
      }
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
        stream.current = null;
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

      const currentAudioMode = audioModeRef.current;
      console.log('Audio mode:', currentAudioMode);
      
      // 获取屏幕视频流（可能包含系统音频）
      const needsSystemAudio = currentAudioMode === 'system' || currentAudioMode === 'both';
      console.log('Needs system audio:', needsSystemAudio);
      
      const videoStream = await (navigator.mediaDevices as any).getUserMedia({
        audio: needsSystemAudio ? {
          mandatory: {
            chromeMediaSource: "desktop",
          },
        } : false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: selectedSource.id,
            maxWidth: TARGET_WIDTH,
            maxHeight: TARGET_HEIGHT,
            maxFrameRate: TARGET_FRAME_RATE,
            minFrameRate: 30,
          },
        },
      });

      // 收集所有轨道
      const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
      console.log('Video tracks:', videoStream.getVideoTracks().length);
      console.log('System audio tracks from desktop:', videoStream.getAudioTracks().length);
      
      // 添加系统音频轨道
      if (needsSystemAudio) {
        const systemAudioTracks = videoStream.getAudioTracks();
        if (systemAudioTracks.length > 0) {
          tracks.push(...systemAudioTracks);
          console.log('Added system audio tracks');
        } else {
          console.warn('No system audio tracks available from desktop capture');
        }
      }

      // 获取麦克风音频
      const needsMicAudio = currentAudioMode === 'mic' || currentAudioMode === 'both';
      console.log('Needs mic audio:', needsMicAudio);
      
      if (needsMicAudio) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
            video: false,
          });
          const micTracks = micStream.getAudioTracks();
          console.log('Mic audio tracks:', micTracks.length);
          tracks.push(...micTracks);
        } catch (micError) {
          console.warn('无法获取麦克风音频:', micError);
        }
      }

      console.log('Total tracks:', tracks.length, '(video:', tracks.filter(t => t.kind === 'video').length, ', audio:', tracks.filter(t => t.kind === 'audio').length, ')');

      // 如果有多个音频轨道，需要混合它们
      const audioTracks = tracks.filter(t => t.kind === 'audio');
      const videoTracks = tracks.filter(t => t.kind === 'video');
      
      let finalStream: MediaStream;
      
      if (audioTracks.length > 1) {
        // 使用 AudioContext 混合多个音频轨道
        console.log('Mixing', audioTracks.length, 'audio tracks');
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        
        audioTracks.forEach((track, index) => {
          const source = audioContext.createMediaStreamSource(new MediaStream([track]));
          source.connect(destination);
          console.log(`Connected audio track ${index + 1}`);
        });
        
        // 创建最终的流：视频轨道 + 混合后的音频轨道
        finalStream = new MediaStream([
          ...videoTracks,
          ...destination.stream.getAudioTracks()
        ]);
      } else {
        finalStream = new MediaStream(tracks);
      }

      stream.current = finalStream;
      if (!stream.current) {
        throw new Error("Media stream is not available.");
      }
      const videoTrack = stream.current.getVideoTracks()[0];
      try {
        await videoTrack.applyConstraints({
          frameRate: { ideal: TARGET_FRAME_RATE, max: TARGET_FRAME_RATE },
          width: { ideal: TARGET_WIDTH, max: TARGET_WIDTH },
          height: { ideal: TARGET_HEIGHT, max: TARGET_HEIGHT },
        });
      } catch (error) {
        console.warn("Unable to lock 4K/60fps constraints, using best available track settings.", error);
      }

      let { width = 1920, height = 1080, frameRate = TARGET_FRAME_RATE } = videoTrack.getSettings();
      
      // Ensure dimensions are divisible by 2 for VP9/AV1 codec compatibility
      width = Math.floor(width / 2) * 2;
      height = Math.floor(height / 2) * 2;
      
      const videoBitsPerSecond = computeBitrate(width, height);
      const mimeType = selectMimeType();

      console.log(
        `Recording at ${width}x${height} @ ${frameRate ?? TARGET_FRAME_RATE}fps using ${mimeType} / ${Math.round(
          videoBitsPerSecond / 1_000_000
        )} Mbps`
      );
      
      chunks.current = [];
      const recorder = new MediaRecorder(stream.current, {
        mimeType,
        videoBitsPerSecond,
      });
      mediaRecorder.current = recorder;
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.current = null;
        if (chunks.current.length === 0) return;
        const duration = Date.now() - startTime.current;
        const recordedChunks = chunks.current;
        const buggyBlob = new Blob(recordedChunks, { type: mimeType });
        // Clear chunks early to free memory immediately after blob creation
        chunks.current = [];
        const timestamp = Date.now();
        const videoFileName = `recording-${timestamp}.webm`;

        try {
          const videoBlob = await fixWebmDuration(buggyBlob, duration);
          const arrayBuffer = await videoBlob.arrayBuffer();
          const videoResult = await window.electronAPI.storeRecordedVideo(arrayBuffer, videoFileName);
          if (!videoResult.success) {
            console.error('Failed to store video:', videoResult.message);
            return;
          }

          if (videoResult.path) {
            await window.electronAPI.setCurrentVideoPath(videoResult.path);
          }

          await window.electronAPI.switchToEditor();
        } catch (error) {
          console.error('Error saving recording:', error);
        }
      };
      recorder.onerror = () => setRecording(false);
      recorder.start(1000);
      startTime.current = Date.now();
      setRecording(true);
      window.electronAPI?.setRecordingState(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecording(false);
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
        stream.current = null;
      }
    }
  };

  const toggleRecording = () => {
    recording ? stopRecording.current() : startRecording();
  };

  return { recording, toggleRecording, audioMode, setAudioMode };
}
