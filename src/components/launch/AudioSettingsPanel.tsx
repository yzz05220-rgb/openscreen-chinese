import { useTranslation } from 'react-i18next';
import { HiMiniSpeakerWave, HiMiniSpeakerXMark, HiMiniMicrophone } from "react-icons/hi2";
import { IoRefresh } from "react-icons/io5";
import { type AudioMode, type AudioDeviceInfo } from "../../hooks/useAudioDevices";
import styles from "./LaunchWindow.module.css";

interface AudioSettingsPanelProps {
  audioMode: AudioMode;
  onAudioModeChange: (mode: AudioMode) => void;
  selectedMicDevice: AudioDeviceInfo | null;
  onMicDeviceChange: (deviceId: string | null) => void;
  audioInputDevices: AudioDeviceInfo[];
  isOpen: boolean;
  onRefresh: () => void;
  isLoading: boolean;
}

export function AudioSettingsPanel({
  audioMode,
  onAudioModeChange,
  selectedMicDevice,
  onMicDeviceChange,
  audioInputDevices,
  isOpen,
  onRefresh,
  isLoading
}: AudioSettingsPanelProps) {
  const { t } = useTranslation();

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

  const audioModes: AudioMode[] = ['none', 'system', 'mic', 'both'];
  const needsMic = audioMode === 'mic' || audioMode === 'both';

  return (
    <div 
      className={`absolute left-1/2 -translate-x-1/2 top-full mt-3 rounded-xl overflow-hidden ${styles.electronNoDrag}`}
      style={{
        background: 'linear-gradient(135deg, rgba(30,30,40,0.95) 0%, rgba(20,20,30,0.92) 100%)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2) inset',
        border: '1px solid rgba(80,80,120,0.22)',
        minWidth: '200px',
        zIndex: 9999,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 音频模式选择 */}
      <div className="border-b border-white/10 pb-2">
        <div className="px-3 py-2 text-[10px] text-white/50 uppercase tracking-wider">
          {t('recording.audio_mode', '音频模式')}
        </div>
        {audioModes.map((mode) => (
          <button
            key={mode}
            onClick={() => onAudioModeChange(mode)}
            className={`w-full px-4 py-2 flex items-center gap-2 text-xs transition-colors ${
              audioMode === mode 
                ? 'text-[#34B27B] bg-[#34B27B]/10' 
                : 'text-white/80 hover:bg-white/5 hover:text-white'
            }`}
          >
            {getAudioIcon(mode)}
            <span>{t(`recording.audio_${mode}_short`)}</span>
          </button>
        ))}
      </div>

      {/* 麦克风设备选择 - 仅在需要麦克风时显示 */}
      {needsMic && (
        <div className="pt-2">
          <div className="px-3 py-2 text-[10px] text-white/50 uppercase tracking-wider flex items-center justify-between">
            <span>{t('recording.mic_device', '麦克风设备')}</span>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title={t('common.refresh', '刷新')}
            >
              <IoRefresh size={12} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          
          {isLoading ? (
            <div className="px-4 py-3 text-xs text-white/50">
              {t('common.loading', '加载中...')}
            </div>
          ) : audioInputDevices.length === 0 ? (
            <div className="px-4 py-3 text-xs text-white/50">
              {t('recording.no_mic_devices', '未检测到麦克风设备')}
            </div>
          ) : (
            <>
              {/* 默认设备选项 */}
              <button
                onClick={() => onMicDeviceChange(null)}
                className={`w-full px-4 py-2 flex items-center gap-2 text-xs transition-colors ${
                  selectedMicDevice === null
                    ? 'text-[#34B27B] bg-[#34B27B]/10' 
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <HiMiniMicrophone size={12} />
                <span className="truncate">{t('recording.default_mic', '系统默认')}</span>
              </button>
              
              {/* 具体设备列表 */}
              {audioInputDevices.map((device) => (
                <button
                  key={device.deviceId}
                  onClick={() => onMicDeviceChange(device.deviceId)}
                  className={`w-full px-4 py-2 flex items-center gap-2 text-xs transition-colors ${
                    selectedMicDevice?.deviceId === device.deviceId
                      ? 'text-[#34B27B] bg-[#34B27B]/10' 
                      : 'text-white/80 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <HiMiniMicrophone size={12} />
                  <span className="truncate" title={device.label}>{device.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
