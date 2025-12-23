import { HelpCircle, Settings, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { formatShortcut } from "@/utils/platformUtils";
import { Button } from "@/components/ui/button";

interface ShortcutSettings {
  stopRecording: string;
  pauseRecording: string;
}

// 将按键事件转换为 Electron 快捷键格式
function keyEventToAccelerator(e: KeyboardEvent): string {
  const parts: string[] = [];
  
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  
  let key = e.key;
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return '';
  
  if (key === ' ') key = 'Space';
  else if (key === 'ArrowUp') key = 'Up';
  else if (key === 'ArrowDown') key = 'Down';
  else if (key === 'ArrowLeft') key = 'Left';
  else if (key === 'ArrowRight') key = 'Right';
  else if (key.length === 1) key = key.toUpperCase();
  
  parts.push(key);
  if (parts.length < 2) return '';
  return parts.join('+');
}

// 将 Electron 快捷键格式转换为显示格式
function acceleratorToDisplay(accelerator: string): string {
  if (!accelerator) return '未设置';
  return accelerator
    .replace('CommandOrControl', 'Ctrl')
    .replace('Command', '⌘')
    .replace('Control', 'Ctrl')
    .replace(/\+/g, ' + ');
}

export function KeyboardShortcutsHelp() {
  const { t } = useTranslation();
  const [shortcuts, setShortcuts] = useState({
    delete: 'Ctrl + D',
    pan: 'Shift + Ctrl + Scroll',
    zoom: 'Ctrl + Scroll'
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [globalShortcuts, setGlobalShortcuts] = useState<ShortcutSettings>({
    stopRecording: 'CommandOrControl+Shift+S',
    pauseRecording: 'CommandOrControl+Shift+P'
  });
  const [editingKey, setEditingKey] = useState<keyof ShortcutSettings | null>(null);
  const [tempKey, setTempKey] = useState('');

  useEffect(() => {
    Promise.all([
      formatShortcut(['mod', 'D']),
      formatShortcut(['shift', 'mod', 'Scroll']),
      formatShortcut(['mod', 'Scroll'])
    ]).then(([deleteKey, panKey, zoomKey]) => {
      setShortcuts({
        delete: deleteKey,
        pan: panKey,
        zoom: zoomKey
      });
    });
  }, []);

  // 加载全局快捷键设置
  useEffect(() => {
    if (window.electronAPI?.getShortcutSettings) {
      window.electronAPI.getShortcutSettings().then((settings) => {
        if (settings) setGlobalShortcuts(settings);
      });
    }
  }, []);

  // 处理按键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!editingKey) return;
    e.preventDefault();
    e.stopPropagation();
    const accelerator = keyEventToAccelerator(e);
    if (accelerator) setTempKey(accelerator);
  }, [editingKey]);

  const handleKeyUp = useCallback(() => {
    if (!editingKey || !tempKey) return;
    const newSettings = { ...globalShortcuts, [editingKey]: tempKey };
    setGlobalShortcuts(newSettings);
    if (window.electronAPI?.setShortcutSettings) {
      window.electronAPI.setShortcutSettings(newSettings);
    }
    setEditingKey(null);
    setTempKey('');
  }, [editingKey, tempKey, globalShortcuts]);

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

  const clearShortcut = (key: keyof ShortcutSettings) => {
    const newSettings = { ...globalShortcuts, [key]: '' };
    setGlobalShortcuts(newSettings);
    if (window.electronAPI?.setShortcutSettings) {
      window.electronAPI.setShortcutSettings(newSettings);
    }
  };

  return (
    <div className="relative group">
      <div className="flex items-center gap-1">
        <HelpCircle className="w-4 h-4 text-slate-500 hover:text-[#34B27B] transition-colors cursor-help" />
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-0.5 text-slate-500 hover:text-[#34B27B] transition-colors"
          title={t('shortcuts.globalShortcuts')}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {/* 快捷键帮助悬浮框 */}
      <div className="absolute right-0 top-full mt-2 w-64 bg-[#09090b] border border-white/10 rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
        <div className="text-xs font-semibold text-slate-200 mb-2">{t('shortcuts.title')}</div>
        <div className="space-y-1.5 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('shortcuts.addZoom')}</span>
            <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#34B27B] font-mono">Z</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('shortcuts.addAnnotation')}</span>
            <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#34B27B] font-mono">A</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('shortcuts.addKeyframe')}</span>
            <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#34B27B] font-mono">F</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('shortcuts.addTrim')}</span>
            <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#34B27B] font-mono">T</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('shortcuts.deleteSelected')}</span>
            <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#34B27B] font-mono">{shortcuts.delete}</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('shortcuts.panTimeline')}</span>
            <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#34B27B] font-mono">{shortcuts.pan}</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('shortcuts.zoomTimeline')}</span>
            <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#34B27B] font-mono">{shortcuts.zoom}</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('shortcuts.pausePlay')}</span>
            <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[#34B27B] font-mono">Space</kbd>
          </div>
        </div>
      </div>

      {/* 全局快捷键设置弹窗 */}
      {showSettings && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowSettings(false)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 bg-[#09090b] border border-white/10 rounded-xl p-4 z-50 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-200">{t('shortcuts.globalShortcuts')}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-white hover:bg-white/10"
                onClick={() => setShowSettings(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {/* 停止录制 */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">{t('shortcuts.stopRecording')}</label>
                <div 
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    editingKey === 'stopRecording' 
                      ? 'bg-[#34B27B]/20 border border-[#34B27B]/50' 
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}
                  onClick={() => { setEditingKey('stopRecording'); setTempKey(''); }}
                >
                  <span className="text-sm text-slate-200 font-mono">
                    {editingKey === 'stopRecording' 
                      ? (tempKey ? acceleratorToDisplay(tempKey) : t('shortcuts.pressKey'))
                      : acceleratorToDisplay(globalShortcuts.stopRecording)
                    }
                  </span>
                  {globalShortcuts.stopRecording && editingKey !== 'stopRecording' && (
                    <button
                      className="text-slate-500 hover:text-red-400"
                      onClick={(e) => { e.stopPropagation(); clearShortcut('stopRecording'); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 暂停录制 */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">{t('shortcuts.pauseRecording')}</label>
                <div 
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    editingKey === 'pauseRecording' 
                      ? 'bg-[#34B27B]/20 border border-[#34B27B]/50' 
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}
                  onClick={() => { setEditingKey('pauseRecording'); setTempKey(''); }}
                >
                  <span className="text-sm text-slate-200 font-mono">
                    {editingKey === 'pauseRecording' 
                      ? (tempKey ? acceleratorToDisplay(tempKey) : t('shortcuts.pressKey'))
                      : acceleratorToDisplay(globalShortcuts.pauseRecording)
                    }
                  </span>
                  {globalShortcuts.pauseRecording && editingKey !== 'pauseRecording' && (
                    <button
                      className="text-slate-500 hover:text-red-400"
                      onClick={(e) => { e.stopPropagation(); clearShortcut('pauseRecording'); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-500 pt-2">
                点击输入框后按下新的快捷键组合
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
