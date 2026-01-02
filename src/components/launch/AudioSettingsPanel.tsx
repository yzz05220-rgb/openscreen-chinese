import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { HiMiniSpeakerWave, HiMiniSpeakerXMark, HiMiniMicrophone } from "react-icons/hi2";
import { type AudioMode } from "../../hooks/useAudioDevices";
import styles from "./LaunchWindow.module.css";

interface AudioSettingsPanelProps {
  audioMode: AudioMode;
  onAudioModeChange: (mode: AudioMode) => void;
  isOpen: boolean;
  anchorRef?: React.RefObject<HTMLDivElement>;
}

export function AudioSettingsPanel({
  audioMode,
  onAudioModeChange,
  isOpen,
  anchorRef
}: AudioSettingsPanelProps) {
  useTranslation(); // 保留以备将来使用
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // 计算面板位置
  useEffect(() => {
    if (isOpen && anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
      });
    }
  }, [isOpen, anchorRef]);

  if (!isOpen) return null;

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

  // 音频模式选项
  const audioModes: { mode: AudioMode; label: string }[] = [
    { mode: 'none', label: '静音' },
    { mode: 'system', label: '系统声音' },
    { mode: 'mic', label: '麦克风' },
    { mode: 'both', label: '全部' },
  ];

  const panelContent = (
    <div
      data-audio-panel="true"
      className={`fixed rounded-xl ${styles.electronNoDrag}`}
      style={{
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, -100%)',
        background: 'linear-gradient(135deg, rgba(30,30,40,0.95) 0%, rgba(20,20,30,0.92) 100%)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2) inset',
        border: '1px solid rgba(80,80,120,0.22)',
        minWidth: '160px',
        zIndex: 99999,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 音频模式选择 */}
      <div className="py-1">
        {audioModes.map(({ mode, label }) => (
          <button
            key={mode}
            onClick={(e) => {
              e.stopPropagation();
              console.log('Audio mode clicked:', mode);
              onAudioModeChange(mode);
            }}
            style={{ pointerEvents: 'auto' }}
            className={`w-full px-4 py-2 flex items-center gap-3 text-xs transition-colors ${audioMode === mode
                ? 'text-[#34B27B] bg-[#34B27B]/10'
                : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
          >
            {getAudioIcon(mode)}
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return createPortal(panelContent, document.body);
}
