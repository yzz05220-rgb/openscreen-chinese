/**
 * 智能缩放面板组件 - 精简版
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Key, 
  Eye, 
  EyeOff, 
  Loader2,
  Settings2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  performSmartZoomAnalysis,
  getStoredApiKey,
  storeApiKey,
  type SmartZoomSettings,
  type AnalysisProgress,
  DEFAULT_SMART_ZOOM_SETTINGS
} from '@/lib/smartZoom/smartZoomAnalyzer';
import { validateApiKey } from '@/lib/smartZoom/geminiService';
import type { ZoomRegion } from './types';

interface SmartZoomPanelProps {
  videoElement: HTMLVideoElement | null;
  onZoomsGenerated: (regions: ZoomRegion[]) => void;
}

export function SmartZoomPanel({
  videoElement,
  onZoomsGenerated
}: SmartZoomPanelProps) {
  const { t } = useTranslation();
  
  // 设置状态 - 从本地存储加载 API Key
  const [settings, setSettings] = useState<SmartZoomSettings>(() => ({
    ...DEFAULT_SMART_ZOOM_SETTINGS,
    apiKey: getStoredApiKey()
  }));
  
  // UI 状态
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [inputApiKey, setInputApiKey] = useState('');

  // 是否已配置并验证 API Key
  const hasValidApiKey = Boolean(settings.apiKey);

  // 执行分析并自动应用
  const runAnalysisAndApply = useCallback(async () => {
    if (!videoElement || !settings.apiKey) return;

    setIsAnalyzing(true);
    setProgress(null);

    try {
      const result = await performSmartZoomAnalysis(
        videoElement,
        { ...settings, useAI: true },
        (p: AnalysisProgress) => setProgress(p)
      );

      if (result.success && result.regions.length > 0) {
        // 自动应用生成的缩放点
        onZoomsGenerated(result.regions);
        toast.success(t('smartZoom.autoApplied', { count: result.regions.length }));
      } else if (result.success) {
        toast.info(t('smartZoom.noZoomsFound'));
      } else {
        toast.error(result.error || t('smartZoom.error'));
      }
    } catch (error) {
      toast.error(t('smartZoom.error'));
      console.error('智能缩放分析失败:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [videoElement, settings, onZoomsGenerated, t]);

  // 测试 API Key
  const handleTestApiKey = useCallback(async () => {
    if (!inputApiKey.trim()) {
      toast.error(t('smartZoom.noApiKey'));
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const isValid = await validateApiKey(inputApiKey.trim());
      if (isValid) {
        setTestResult('success');
        toast.success(t('smartZoom.apiTestSuccess'));
      } else {
        setTestResult('failed');
        toast.error(t('smartZoom.apiTestFailed'));
      }
    } catch (error) {
      setTestResult('failed');
      toast.error(t('smartZoom.apiTestFailed'));
    } finally {
      setIsTesting(false);
    }
  }, [inputApiKey, t]);

  // 确认保存 API Key 并自动开始分析
  const handleConfirmSave = useCallback(async () => {
    const apiKey = inputApiKey.trim();
    // 保存到本地存储
    storeApiKey(apiKey);
    setSettings((s: SmartZoomSettings) => ({ ...s, apiKey }));
    setInputApiKey('');
    setTestResult(null);
    toast.success(t('smartZoom.apiKeySaved'));
    
    // 自动开始分析
    if (videoElement) {
      // 延迟一下让状态更新
      setTimeout(async () => {
        setIsAnalyzing(true);
        setProgress(null);

        try {
          const result = await performSmartZoomAnalysis(
            videoElement,
            { ...DEFAULT_SMART_ZOOM_SETTINGS, apiKey, useAI: true },
            (p: AnalysisProgress) => setProgress(p)
          );

          if (result.success && result.regions.length > 0) {
            onZoomsGenerated(result.regions);
            toast.success(t('smartZoom.autoApplied', { count: result.regions.length }));
          } else if (result.success) {
            toast.info(t('smartZoom.noZoomsFound'));
          } else {
            toast.error(result.error || t('smartZoom.error'));
          }
        } catch (error) {
          toast.error(t('smartZoom.error'));
        } finally {
          setIsAnalyzing(false);
        }
      }, 100);
    }
  }, [inputApiKey, videoElement, onZoomsGenerated, t]);

  // 清除 API Key
  const handleClearApiKey = useCallback(() => {
    setSettings((s: SmartZoomSettings) => ({ ...s, apiKey: '' }));
    storeApiKey('');
    setShowSettings(false);
    setTestResult(null);
    setInputApiKey('');
    toast.success(t('smartZoom.apiKeyCleared'));
  }, [t]);

  // 未配置 API Key - 显示配置界面
  if (!hasValidApiKey) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#34B27B]" />
          <span className="text-sm font-medium text-slate-200">{t('smartZoom.title')}</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">Gemini API Key</span>
          </div>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={inputApiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setInputApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder={t('smartZoom.apiKeyPlaceholder')}
              className="w-full h-8 text-xs bg-white/5 border border-white/10 rounded-lg px-3 pr-8 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#34B27B]"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#34B27B] hover:underline"
          >
            {t('smartZoom.apiKeyHint')} →
          </a>
          
          {/* 测试结果显示 */}
          {testResult && (
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-lg text-xs",
              testResult === 'success' 
                ? "bg-green-500/10 text-green-400" 
                : "bg-red-500/10 text-red-400"
            )}>
              {testResult === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {t('smartZoom.apiTestSuccess')}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  {t('smartZoom.apiTestFailed')}
                </>
              )}
            </div>
          )}
          
          {/* 按钮区域 */}
          <div className="flex gap-2 pt-1">
            {testResult === 'success' ? (
              <Button
                onClick={handleConfirmSave}
                className="flex-1 h-8 text-xs bg-[#34B27B] hover:bg-[#34B27B]/90"
              >
                {t('smartZoom.confirmSave')}
              </Button>
            ) : (
              <Button
                onClick={handleTestApiKey}
                disabled={!inputApiKey.trim() || isTesting}
                className="flex-1 h-8 text-xs bg-white/10 hover:bg-white/20"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {t('smartZoom.testing')}
                  </>
                ) : (
                  t('smartZoom.testConnection')
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 已配置 API Key - 显示精简界面
  return (
    <div className="space-y-3">
      {/* 进度显示 */}
      {isAnalyzing && progress && (
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-[#34B27B] animate-spin" />
            <span className="text-xs text-slate-200">{progress.message}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#34B27B] transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* 主按钮和设置 */}
      <div className="flex gap-2">
        <Button
          onClick={runAnalysisAndApply}
          disabled={isAnalyzing || !videoElement}
          className={cn(
            "flex-1 gap-2 transition-all",
            isAnalyzing
              ? "bg-white/10 text-slate-400"
              : "bg-[#34B27B] hover:bg-[#34B27B]/90 text-white"
          )}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('smartZoom.analyzing')}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {t('smartZoom.analyze')}
            </>
          )}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setShowSettings(!showSettings)}
          className="h-9 w-9 bg-white/5 border-white/10 hover:bg-white/10"
        >
          <Settings2 className="w-4 h-4" />
        </Button>
      </div>

      {/* 展开的设置面板 */}
      {showSettings && (
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">API Key: ****{settings.apiKey.slice(-4)}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearApiKey}
              className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              {t('smartZoom.clearApiKey')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
