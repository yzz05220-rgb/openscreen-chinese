import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { FiX } from 'react-icons/fi';

interface ShortcutSettings {
  stopRecording: string;
  pauseRecording: string;
}

interface ShortcutSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// 将按键事件转换为 Electron 快捷键格式
function keyEventToAccelerator(e: KeyboardEvent): string {
  const parts: string[] = [];
  
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  
  // 获取按键
  let key = e.key;
  
  // 忽略单独的修饰键
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    return '';
  }
  
  // 转换特殊键
  if (key === ' ') key = 'Space';
  else if (key === 'ArrowUp') key = 'Up';
  else if (key === 'ArrowDown') key = 'Down';
  else if (key === 'ArrowLeft') key = 'Left';
  else if (key === 'ArrowRight') key = 'Right';
  else if (key.length === 1) key = key.toUpperCase();
  
  parts.push(key);
  
  // 至少需要一个修饰键
  if (parts.length < 2) {
    return '';
  }
  
  return parts.join('+');
}

// 将 Electron 快捷键格式转换为显示格式
function acceleratorToDisplay(accelerator: string): string {
  if (!accelerator) return '';
  
  return accelerator
    .replace('CommandOrControl', 'Ctrl')
    .replace('Command', '⌘')
    .replace('Control', 'Ctrl')
    .replace('Shift', 'Shift')
    .replace('Alt', 'Alt')
    .replace(/\+/g, ' + ');
}

export function ShortcutSettings({ isOpen, onClose }: ShortcutSettingsProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ShortcutSettings>({
    stopRecording: 'CommandOrControl+Shift+S',
    pauseRecording: 'CommandOrControl+Shift+P'
  });
  const [editingKey, setEditingKey] = useState<keyof ShortcutSettings | null>(null);
  const [tempKey, setTempKey] = useState('');

  // 加载设置
  useEffect(() => {
    if (isOpen && window.electronAPI?.getShortcutSettings) {
      window.electronAPI.getShortcutSettings().then((savedSettings: ShortcutSettings) => {
        if (savedSettings) {
          setSettings(savedSettings);
        }
      });
    }
  }, [isOpen]);

  // 处理按键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!editingKey) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const accelerator = keyEventToAccelerator(e);
    if (accelerator) {
      setTempKey(accelerator);
    }
  }, [editingKey]);

  const handleKeyUp = useCallback(() => {
    if (!editingKey || !tempKey) return;
    
    // 保存快捷键
    const newSettings = { ...settings, [editingKey]: tempKey };
    setSettings(newSettings);
    
    if (window.electronAPI?.setShortcutSettings) {
      window.electronAPI.setShortcutSettings(newSettings);
    }
    
    setEditingKey(null);
    setTempKey('');
  }, [editingKey, tempKey, settings]);

  useEffect(() => {
    if (editingKey) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [editingKey, handleKeyDown, handleKeyUp]);

  // 清除快捷键
  const clearShortcut = (key: keyof ShortcutSettings) => {
    const newSettings = { ...settings, [key]: '' };
    setSettings(newSettings);
    
    if (window.electronAPI?.setShortcutSettings) {
      window.electronAPI.setShortcutSettings(newSettings);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="absolute bottom-full left-0 mb-2 w-72 rounded-lg overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(30,30,40,0.98) 0%, rgba(20,20,30,0.95) 100%)',
        backdropFilter: 'blur(32px)',
        border: '1px solid rgba(80,80,120,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-white/90 text-sm font-medium">
          {t('shortcuts.globalShortcuts')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
          onClick={onClose}
        >
          <FiX size={14} />
        </Button>
      </div>

      {/* 快捷键列表 */}
      <div className="p-3 space-y-3">
        {/* 停止录制 */}
        <div className="space-y-1">
          <label className="text-white/70 text-xs">
            {t('shortcuts.stopRecording')}
          </label>
          <div 
            className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
              editingKey === 'stopRecording' 
                ? 'bg-blue-500/30 border border-blue-500/50' 
                : 'bg-white/5 hover:bg-white/10 border border-transparent'
            }`}
            onClick={() => {
              setEditingKey('stopRecording');
              setTempKey('');
            }}
          >
            <span className="text-white/90 text-sm font-mono">
              {editingKey === 'stopRecording' 
                ? (tempKey ? acceleratorToDisplay(tempKey) : t('shortcuts.pressKey'))
                : acceleratorToDisplay(settings.stopRecording) || '未设置'
              }
            </span>
            {settings.stopRecording && editingKey !== 'stopRecording' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-white/40 hover:text-red-400 hover:bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  clearShortcut('stopRecording');
                }}
              >
                <FiX size={12} />
              </Button>
            )}
          </div>
        </div>

        {/* 暂停录制 */}
        <div className="space-y-1">
          <label className="text-white/70 text-xs">
            {t('shortcuts.pauseRecording')}
          </label>
          <div 
            className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
              editingKey === 'pauseRecording' 
                ? 'bg-blue-500/30 border border-blue-500/50' 
                : 'bg-white/5 hover:bg-white/10 border border-transparent'
            }`}
            onClick={() => {
              setEditingKey('pauseRecording');
              setTempKey('');
            }}
          >
            <span className="text-white/90 text-sm font-mono">
              {editingKey === 'pauseRecording' 
                ? (tempKey ? acceleratorToDisplay(tempKey) : t('shortcuts.pressKey'))
                : acceleratorToDisplay(settings.pauseRecording) || '未设置'
              }
            </span>
            {settings.pauseRecording && editingKey !== 'pauseRecording' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-white/40 hover:text-red-400 hover:bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  clearShortcut('pauseRecording');
                }}
              >
                <FiX size={12} />
              </Button>
            )}
          </div>
        </div>

        {/* 提示 */}
        <p className="text-white/40 text-xs pt-1">
          点击输入框后按下新的快捷键组合
        </p>
      </div>
    </div>
  );
}
