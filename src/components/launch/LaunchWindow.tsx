import { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import styles from "./LaunchWindow.module.css";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { useAudioDevices, type AudioMode } from "../../hooks/useAudioDevices";
import { AudioSettingsPanel } from "./AudioSettingsPanel";
import { Button } from "../ui/button";
import { BsRecordCircle, BsPauseFill, BsPlayFill } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import { MdMonitor } from "react-icons/md";
import { RxDragHandleDots2 } from "react-icons/rx";
import { FaFolderMinus } from "react-icons/fa6";
import { FiMinus, FiX } from "react-icons/fi";
import { HiMiniSpeakerWave, HiMiniSpeakerXMark, HiMiniMicrophone } from "react-icons/hi2";
import { ContentClamp } from "../ui/content-clamp";

export function LaunchWindow() {
  const { t } = useTranslation();

  // 使用新的音频设备管理 Hook
  const {
    selectedMicDevice,
    audioMode,
    setAudioMode,
  } = useAudioDevices();

  // 录制 Hook，传入选中的麦克风设备 ID
  const { recording, paused, toggleRecording, togglePause } = useScreenRecorder(
    audioMode,
    selectedMicDevice?.deviceId || null
  );

  const [showAudioOptions, setShowAudioOptions] = useState(false);
  const audioRef = useRef<HTMLDivElement>(null);
  const [recordingStart, setRecordingStart] = useState<number | null>(null);
  const [pausedDuration, setPausedDuration] = useState(0);
  const [pauseStart, setPauseStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (recording) {
      if (!recordingStart) setRecordingStart(Date.now());
      timer = setInterval(() => {
        if (recordingStart) {
          const now = Date.now();
          let totalPaused = pausedDuration;
          if (paused && pauseStart) {
            totalPaused += now - pauseStart;
          }
          setElapsed(Math.floor((now - recordingStart - totalPaused) / 1000));
        }
      }, 1000);
    } else {
      setRecordingStart(null);
      setElapsed(0);
      setPausedDuration(0);
      setPauseStart(null);
      if (timer) clearInterval(timer);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [recording, recordingStart, paused, pauseStart, pausedDuration]);

  // 处理暂停状态变化
  useEffect(() => {
    if (paused) {
      setPauseStart(Date.now());
    } else if (pauseStart) {
      setPausedDuration(prev => prev + (Date.now() - pauseStart));
      setPauseStart(null);
    }
  }, [paused]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [hasSelectedSource, setHasSelectedSource] = useState(false);

  useEffect(() => {
    const checkSelectedSource = async () => {
      if (window.electronAPI) {
        const source = await window.electronAPI.getSelectedSource();
        if (source) {
          setSelectedSource(source.name);
          setHasSelectedSource(true);
        } else {
          setSelectedSource(null);
          setHasSelectedSource(false);
        }
      }
    };

    checkSelectedSource();

    const interval = setInterval(checkSelectedSource, 500);
    return () => clearInterval(interval);
  }, []);

  const openSourceSelector = () => {
    if (window.electronAPI) {
      window.electronAPI.openSourceSelector();
    }
  };

  const openVideoFile = async () => {
    const result = await window.electronAPI.openVideoFilePicker();

    if (result.cancelled) {
      return;
    }

    if (result.success && result.path) {
      await window.electronAPI.setCurrentVideoPath(result.path);
      await window.electronAPI.switchToEditor();
    }
  };

  // IPC events for hide/close
  const sendHudOverlayHide = () => {
    if (window.electronAPI && window.electronAPI.hudOverlayHide) {
      window.electronAPI.hudOverlayHide();
    }
  };
  const sendHudOverlayClose = () => {
    if (window.electronAPI && window.electronAPI.hudOverlayClose) {
      window.electronAPI.hudOverlayClose();
    }
  };

  // 获取音频模式图标
  const getAudioIcon = (mode: AudioMode) => {
    switch (mode) {
      case 'system':
        return <HiMiniSpeakerWave size={14} />;
      case 'mic':
        return <HiMiniMicrophone size={14} />;
      case 'both':
        return (
          <div className="flex items-center -space-x-1">
            <HiMiniSpeakerWave size={12} />
            <HiMiniMicrophone size={12} />
          </div>
        );
      default:
        return <HiMiniSpeakerXMark size={14} />;
    }
  };

  // 获取当前选中模式的标签
  const getAudioLabel = () => {
    return t(`recording.audio_${audioMode}_short`);
  };

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // 检查点击是否在音频按钮区域内
      const isInAudioRef = audioRef.current && audioRef.current.contains(target);
      // 检查点击是否在弹出面板内（Portal 渲染的元素）
      const isInPanel = (target as Element).closest?.('[data-audio-panel="true"]');
      
      if (!isInAudioRef && !isInPanel) {
        setShowAudioOptions(false);
      }
    };
    if (showAudioOptions) {
      // 使用 mousedown 而不是 click，并添加延迟以避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAudioOptions]);

  // Windows 平台上 setIgnoreMouseEvents 的 forward 选项不能正常工作
  // 所以我们不使用它，而是依赖 CSS pointer-events 来控制点击区域
  // 窗口本身不设置 ignoreMouseEvents，让 CSS 来处理透明区域的点击穿透
  useEffect(() => {
    // 在 Windows 上不设置 ignoreMouseEvents，让窗口正常接收鼠标事件
    // 透明区域的点击穿透通过 CSS pointer-events: none 实现
    // window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center bg-transparent hud-overlay pointer-events-none" style={{ paddingTop: '200px' }}>
      <div
        className={`w-full max-w-[500px] mx-auto flex items-center justify-between px-4 py-2 ${styles.electronDrag}`}
        style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(30,30,40,0.92) 0%, rgba(20,20,30,0.85) 100%)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          boxShadow: '0 4px 24px 0 rgba(0,0,0,0.28), 0 1px 3px 0 rgba(0,0,0,0.14) inset',
          border: '1px solid rgba(80,80,120,0.22)',
          minHeight: 44,
          pointerEvents: 'auto' // Ensure this element captures clicks
        }}
      >
        <div className={`flex items-center gap-1 ${styles.electronDrag}`}> <RxDragHandleDots2 size={18} className="text-white/40" /> </div>

        <Button
          variant="link"
          size="sm"
          className={`gap-1 text-white bg-transparent hover:bg-transparent px-0 flex-1 text-left text-xs ${styles.electronNoDrag}`}
          onClick={openSourceSelector}
          disabled={recording}
        >
          <MdMonitor size={14} className="text-white" />
          <ContentClamp truncateLength={6}>{selectedSource || t('common.screen')}</ContentClamp>
        </Button>

        <div className="w-px h-6 bg-white/30" />

        {/* 音频选项 */}
        <div className={`relative flex-1 ${styles.electronNoDrag}`} ref={audioRef}>
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              console.log('Audio button clicked, recording:', recording, 'showAudioOptions:', showAudioOptions);
              if (!recording) {
                setShowAudioOptions(!showAudioOptions);
              }
            }}
            disabled={recording}
            className={`gap-1 text-white bg-transparent hover:bg-transparent px-0 w-full text-left text-xs ${styles.electronNoDrag}`}
          >
            <span className={audioMode !== 'none' ? "text-[#34B27B]" : "text-white"}>
              {getAudioIcon(audioMode)}
            </span>
            <span className={audioMode !== 'none' ? "text-[#34B27B]" : "text-white"}>
              {getAudioLabel()}
            </span>
          </Button>

          {/* 音频设置面板 */}
          <AudioSettingsPanel
            audioMode={audioMode}
            onAudioModeChange={(mode) => {
              console.log('Setting audio mode to:', mode);
              setAudioMode(mode);
              setShowAudioOptions(false);
            }}
            isOpen={showAudioOptions}
            anchorRef={audioRef}
          />
        </div>

        <div className="w-px h-6 bg-white/30" />

        <Button
          variant="link"
          size="sm"
          onClick={hasSelectedSource ? toggleRecording : openSourceSelector}
          disabled={!hasSelectedSource && !recording}
          className={`gap-1 text-white bg-transparent hover:bg-transparent px-0 flex-1 text-center text-xs ${styles.electronNoDrag}`}
        >
          {recording ? (
            <>
              <FaRegStopCircle size={14} className="text-red-400" />
              <span className={paused ? "text-yellow-400" : "text-red-400"}>{formatTime(elapsed)}</span>
            </>
          ) : (
            <>
              <BsRecordCircle size={14} className={hasSelectedSource ? "text-white" : "text-white/50"} />
              <span className={hasSelectedSource ? "text-white" : "text-white/50"}>{t('recording.record')}</span>
            </>
          )}
        </Button>

        {/* 暂停按钮 - 仅在录制时显示 */}
        {recording && (
          <>
            <div className="w-px h-6 bg-white/30" />
            <Button
              variant="link"
              size="sm"
              onClick={togglePause}
              className={`gap-1 text-white bg-transparent hover:bg-transparent px-0 text-center text-xs ${styles.electronNoDrag}`}
              title={paused ? t('recording.resume') : t('recording.pause')}
            >
              {paused ? (
                <BsPlayFill size={16} className="text-green-400" />
              ) : (
                <BsPauseFill size={16} className="text-yellow-400" />
              )}
            </Button>
          </>
        )}

        <div className="w-px h-6 bg-white/30" />


        <Button
          variant="link"
          size="sm"
          onClick={openVideoFile}
          className={`gap-1 text-white bg-transparent hover:bg-transparent px-0 flex-1 text-right text-xs ${styles.electronNoDrag} ${styles.folderButton}`}
          disabled={recording}
        >
          <FaFolderMinus size={14} className="text-white" />
          <span className={styles.folderText}>{t('common.open')}</span>
        </Button>

        {/* Separator before hide/close buttons */}
        <div className="w-px h-6 bg-white/30 mx-2" />
        <Button
          variant="link"
          size="icon"
          className={`ml-2 ${styles.electronNoDrag} hudOverlayButton`}
          title="Hide HUD"
          onClick={sendHudOverlayHide}
        >
          <FiMinus size={18} style={{ color: '#fff', opacity: 0.7 }} />

        </Button>

        <Button
          variant="link"
          size="icon"
          className={`ml-1 ${styles.electronNoDrag} hudOverlayButton`}
          title="Close App"
          onClick={sendHudOverlayClose}
        >
          <FiX size={18} style={{ color: '#fff', opacity: 0.7 }} />
        </Button>
      </div>
    </div>
  );
}
