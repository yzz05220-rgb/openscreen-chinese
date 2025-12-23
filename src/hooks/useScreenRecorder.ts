import { useState, useRef, useEffect } from "react";
import { fixWebmDuration } from "@fix-webm-duration/fix";
import { type AudioMode } from "./useAudioDevices";

type UseScreenRecorderReturn = {
  recording: boolean;
  paused: boolean;
  toggleRecording: () => void;
  togglePause: () => void;
};

export function useScreenRecorder(
  audioMode: AudioMode,
  selectedMicDeviceId: string | null
): UseScreenRecorderReturn {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef<number>(0);
  const pausedTime = useRef<number>(0);  // 累计暂停时间
  const pauseStartTime = useRef<number>(0);  // 暂停开始时间
  
  // 使用 ref 来存储最新的音频设置，避免闭包问题
  const audioModeRef = useRef(audioMode);
  const selectedMicDeviceIdRef = useRef(selectedMicDeviceId);

  // 同步状态到 ref
  useEffect(() => {
    audioModeRef.current = audioMode;
  }, [audioMode]);

  useEffect(() => {
    selectedMicDeviceIdRef.current = selectedMicDeviceId;
  }, [selectedMicDeviceId]);

  // Target visually lossless 4K @ 60fps; fall back gracefully when hardware cannot keep up
  const TARGET_FRAME_RATE = 60;
  const TARGET_WIDTH = 3840;
  const TARGET_HEIGHT = 2160;
  const FOUR_K_PIXELS = TARGET_WIDTH * TARGET_HEIGHT;
  
  const selectMimeType = () => {
    // 优先使用 H.264 编码，这样转换为 MP4 时更快
    const preferred = [
      "video/webm;codecs=h264",  // H.264 优先，转 MP4 最快
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm;codecs=av1",
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
    if (mediaRecorder.current?.state === "recording" || mediaRecorder.current?.state === "paused") {
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
      }
      mediaRecorder.current.stop();
      setRecording(false);
      setPaused(false);
      pausedTime.current = 0;

      window.electronAPI?.setRecordingState(false);
    }
  });

  // 暂停/继续录制
  const togglePause = useRef(() => {
    if (!mediaRecorder.current) return;
    
    if (mediaRecorder.current.state === "recording") {
      mediaRecorder.current.pause();
      pauseStartTime.current = Date.now();
      setPaused(true);
      console.log('Recording paused');
    } else if (mediaRecorder.current.state === "paused") {
      mediaRecorder.current.resume();
      // 累加暂停时间
      pausedTime.current += Date.now() - pauseStartTime.current;
      setPaused(false);
      console.log('Recording resumed');
    }
  });

  useEffect(() => {
    let cleanupStop: (() => void) | undefined;
    let cleanupPause: (() => void) | undefined;
    
    if (window.electronAPI?.onStopRecordingFromTray) {
      cleanupStop = window.electronAPI.onStopRecordingFromTray(() => {
        stopRecording.current();
      });
    }
    
    if (window.electronAPI?.onPauseRecordingFromTray) {
      cleanupPause = window.electronAPI.onPauseRecordingFromTray(() => {
        togglePause.current();
      });
    }

    return () => {
      if (cleanupStop) cleanupStop();
      if (cleanupPause) cleanupPause();
      
      if (mediaRecorder.current?.state === "recording" || mediaRecorder.current?.state === "paused") {
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
      const currentMicDeviceId = selectedMicDeviceIdRef.current;
      
      console.log('Audio mode:', currentAudioMode);
      console.log('Selected mic device ID:', currentMicDeviceId);
      
      // 获取屏幕视频流（包含系统音频）
      const needsSystemAudio = currentAudioMode === 'system' || currentAudioMode === 'both';
      console.log('Needs system audio:', needsSystemAudio);
      
      // 收集所有轨道
      const tracks: MediaStreamTrack[] = [];
      
      // 尝试同时获取视频和系统音频（这在某些系统上更可靠）
      if (needsSystemAudio) {
        try {
          console.log('Trying to get video + system audio together...');
          const combinedStream = await (navigator.mediaDevices as any).getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: selectedSource.id,
              },
            },
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
          
          tracks.push(...combinedStream.getVideoTracks());
          tracks.push(...combinedStream.getAudioTracks());
          console.log('Combined stream - Video tracks:', combinedStream.getVideoTracks().length, ', Audio tracks:', combinedStream.getAudioTracks().length);
        } catch (combinedError) {
          console.warn('无法同时获取视频和系统音频，尝试分开获取:', combinedError);
          
          // 分开获取视频
          const videoStream = await (navigator.mediaDevices as any).getUserMedia({
            audio: false,
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
          tracks.push(...videoStream.getVideoTracks());
          console.log('Video tracks (separate):', videoStream.getVideoTracks().length);
          
          // 尝试单独获取系统音频
          try {
            const systemAudioStream = await (navigator.mediaDevices as any).getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: "desktop",
                  chromeMediaSourceId: selectedSource.id,
                },
              },
              video: false,
            });
            
            const systemAudioTracks = systemAudioStream.getAudioTracks();
            console.log('System audio tracks:', systemAudioTracks.length);
            if (systemAudioTracks.length > 0) {
              tracks.push(...systemAudioTracks);
              console.log('Added system audio tracks');
            }
          } catch (systemAudioError) {
            console.warn('无法获取系统音频:', systemAudioError);
          }
        }
      } else {
        // 只获取视频，不需要系统音频
        const videoStream = await (navigator.mediaDevices as any).getUserMedia({
          audio: false,
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
        tracks.push(...videoStream.getVideoTracks());
        console.log('Video tracks (no system audio):', videoStream.getVideoTracks().length);
      }
      
      console.log('After video/system audio - Total tracks:', tracks.length);

      // 获取麦克风音频
      const needsMicAudio = currentAudioMode === 'mic' || currentAudioMode === 'both';
      console.log('Needs mic audio:', needsMicAudio);
      
      if (needsMicAudio) {
        try {
          // 构建麦克风约束
          const micConstraints: MediaTrackConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
          };
          
          // 如果指定了设备 ID，则使用该设备
          if (currentMicDeviceId) {
            micConstraints.deviceId = { exact: currentMicDeviceId };
            console.log('Using specific mic device:', currentMicDeviceId);
          } else {
            console.log('Using default mic device');
          }
          
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: micConstraints,
            video: false,
          });
          const micTracks = micStream.getAudioTracks();
          console.log('Mic audio tracks:', micTracks.length);
          if (micTracks.length > 0) {
            console.log('Mic device label:', micTracks[0].label);
          }
          tracks.push(...micTracks);
        } catch (micError) {
          console.warn('无法获取麦克风音频:', micError);
          // 如果指定的设备失败，尝试使用默认设备
          if (currentMicDeviceId) {
            console.log('Falling back to default mic device...');
            try {
              const fallbackMicStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                },
                video: false,
              });
              const fallbackMicTracks = fallbackMicStream.getAudioTracks();
              console.log('Fallback mic audio tracks:', fallbackMicTracks.length);
              tracks.push(...fallbackMicTracks);
            } catch (fallbackError) {
              console.warn('Fallback mic also failed:', fallbackError);
            }
          }
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
        // 计算实际录制时长（减去暂停时间）
        const totalTime = Date.now() - startTime.current;
        const duration = totalTime - pausedTime.current;
        const recordedChunks = chunks.current;
        const buggyBlob = new Blob(recordedChunks, { type: mimeType });
        // Clear chunks early to free memory immediately after blob creation
        chunks.current = [];
        pausedTime.current = 0;
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

  return { recording, paused, toggleRecording, togglePause: togglePause.current };
}
