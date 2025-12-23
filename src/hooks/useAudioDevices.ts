import { useState, useEffect, useCallback, useRef } from 'react';

// 音频录制模式
export type AudioMode = 'none' | 'system' | 'mic' | 'both';

// 音频设备信息
export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  groupId: string;
}

// 存储的音频设置
interface StoredAudioSettings {
  mode: AudioMode;
  selectedMicDeviceId: string | null;
  lastUpdated: number;
}

// 默认设置
const DEFAULT_AUDIO_SETTINGS: StoredAudioSettings = {
  mode: 'both',  // 默认同时录制系统音频和麦克风
  selectedMicDeviceId: null,  // null 表示使用系统默认设备
  lastUpdated: Date.now()
};

const STORAGE_KEY = 'openscreen-audio-settings';

// Hook 返回类型
export interface UseAudioDevicesReturn {
  // 设备列表
  audioInputDevices: AudioDeviceInfo[];
  audioOutputDevices: AudioDeviceInfo[];
  
  // 当前选择
  selectedMicDevice: AudioDeviceInfo | null;
  audioMode: AudioMode;
  
  // 操作方法
  setSelectedMicDevice: (deviceId: string | null) => void;
  setAudioMode: (mode: AudioMode) => void;
  refreshDevices: () => Promise<void>;
  
  // 状态
  isLoading: boolean;
  error: string | null;
}

// 从 localStorage 加载设置
function loadSettings(): StoredAudioSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredAudioSettings;
      return {
        mode: parsed.mode || DEFAULT_AUDIO_SETTINGS.mode,
        selectedMicDeviceId: parsed.selectedMicDeviceId ?? null,
        lastUpdated: parsed.lastUpdated || Date.now()
      };
    }
  } catch (e) {
    console.warn('Failed to load audio settings:', e);
  }
  return DEFAULT_AUDIO_SETTINGS;
}

// 保存设置到 localStorage
function saveSettings(settings: StoredAudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...settings,
      lastUpdated: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to save audio settings:', e);
  }
}

export function useAudioDevices(): UseAudioDevicesReturn {
  const [audioInputDevices, setAudioInputDevices] = useState<AudioDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<AudioDeviceInfo[]>([]);
  const [audioMode, setAudioModeState] = useState<AudioMode>(() => loadSettings().mode);
  const [selectedMicDeviceId, setSelectedMicDeviceIdState] = useState<string | null>(
    () => loadSettings().selectedMicDeviceId
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isInitialized = useRef(false);

  // 枚举音频设备
  const enumerateDevices = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 首先请求权限（如果还没有）
      // 这样可以获取到设备的完整标签
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // 权限被拒绝或没有设备，继续枚举但可能没有标签
        console.warn('Could not get audio permission, device labels may be empty');
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputDevices: AudioDeviceInfo[] = [];
      const outputDevices: AudioDeviceInfo[] = [];
      
      devices.forEach(device => {
        if (device.kind === 'audioinput') {
          inputDevices.push({
            deviceId: device.deviceId,
            label: device.label || `麦克风 ${inputDevices.length + 1}`,
            kind: 'audioinput',
            groupId: device.groupId
          });
        } else if (device.kind === 'audiooutput') {
          outputDevices.push({
            deviceId: device.deviceId,
            label: device.label || `扬声器 ${outputDevices.length + 1}`,
            kind: 'audiooutput',
            groupId: device.groupId
          });
        }
      });
      
      setAudioInputDevices(inputDevices);
      setAudioOutputDevices(outputDevices);
      
      // 检查选中的设备是否仍然可用
      if (selectedMicDeviceId) {
        const deviceStillExists = inputDevices.some(d => d.deviceId === selectedMicDeviceId);
        if (!deviceStillExists) {
          // 设备不再可用，回退到默认
          console.log('Selected mic device no longer available, falling back to default');
          setSelectedMicDeviceIdState(null);
          saveSettings({
            mode: audioMode,
            selectedMicDeviceId: null,
            lastUpdated: Date.now()
          });
        }
      }
      
    } catch (err) {
      console.error('Failed to enumerate audio devices:', err);
      setError('无法获取音频设备列表');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMicDeviceId, audioMode]);

  // 初始化和设备变化监听
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      enumerateDevices();
    }
    
    // 监听设备变化
    const handleDeviceChange = () => {
      console.log('Audio devices changed, refreshing...');
      enumerateDevices();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  // 设置音频模式
  const setAudioMode = useCallback((mode: AudioMode) => {
    setAudioModeState(mode);
    saveSettings({
      mode,
      selectedMicDeviceId,
      lastUpdated: Date.now()
    });
  }, [selectedMicDeviceId]);

  // 设置选中的麦克风设备
  const setSelectedMicDevice = useCallback((deviceId: string | null) => {
    setSelectedMicDeviceIdState(deviceId);
    saveSettings({
      mode: audioMode,
      selectedMicDeviceId: deviceId,
      lastUpdated: Date.now()
    });
  }, [audioMode]);

  // 刷新设备列表
  const refreshDevices = useCallback(async () => {
    await enumerateDevices();
  }, [enumerateDevices]);

  // 获取当前选中的设备对象
  const selectedMicDevice = selectedMicDeviceId
    ? audioInputDevices.find(d => d.deviceId === selectedMicDeviceId) || null
    : null;

  return {
    audioInputDevices,
    audioOutputDevices,
    selectedMicDevice,
    audioMode,
    setSelectedMicDevice,
    setAudioMode,
    refreshDevices,
    isLoading,
    error
  };
}
