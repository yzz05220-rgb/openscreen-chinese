/**
 * 智能缩放分析器 - 整合帧提取和 AI 分析
 */

import { extractFramesFromVideo, estimateCost, type ExtractionProgress } from './frameExtractor';
import { analyzeFramesWithGemini, type ZoomSuggestion } from './geminiService';
import type { ZoomRegion, ZoomDepth } from '@/components/video-editor/types';
import { v4 as uuidv4 } from 'uuid';

export interface SmartZoomSettings {
  // 缩放密度
  density: 'sparse' | 'normal' | 'dense';
  // 最小间隔（秒）
  minInterval: number;
  // 是否使用 AI
  useAI: boolean;
  // API Key
  apiKey: string;
}

export const DEFAULT_SMART_ZOOM_SETTINGS: SmartZoomSettings = {
  density: 'normal',
  minInterval: 8,
  useAI: true,
  apiKey: ''
};

export interface AnalysisProgress {
  stage: 'extracting' | 'analyzing' | 'processing' | 'done' | 'error';
  message: string;
  percentage: number;
  extractionProgress?: ExtractionProgress;
}

/**
 * 根据密度设置获取采样间隔
 */
function getIntervalByDensity(density: SmartZoomSettings['density']): number {
  switch (density) {
    case 'sparse': return 5;   // 每5秒采样
    case 'normal': return 3;   // 每3秒采样
    case 'dense': return 2;    // 每2秒采样
    default: return 3;
  }
}

/**
 * 将 AI 建议转换为 ZoomRegion
 */
function suggestionToZoomRegion(suggestion: ZoomSuggestion): ZoomRegion {
  return {
    id: uuidv4(),
    startMs: Math.round(suggestion.startTime * 1000),
    endMs: Math.round(suggestion.endTime * 1000),
    depth: suggestion.suggestedDepth as ZoomDepth,
    focus: {
      cx: suggestion.focusX,
      cy: suggestion.focusY
    }
  };
}

/**
 * 过滤和优化缩放建议
 * - 移除间隔太近的建议
 * - 按置信度排序
 */
function optimizeSuggestions(
  suggestions: ZoomSuggestion[],
  minInterval: number,
  videoDuration: number
): ZoomSuggestion[] {
  if (suggestions.length === 0) return [];

  // 按开始时间排序
  const sorted = [...suggestions].sort((a, b) => a.startTime - b.startTime);
  
  // 过滤间隔太近的
  const filtered: ZoomSuggestion[] = [];
  let lastEndTime = -minInterval;

  for (const suggestion of sorted) {
    // 检查与上一个缩放的间隔
    if (suggestion.startTime - lastEndTime >= minInterval) {
      // 确保不超出视频范围
      if (suggestion.endTime <= videoDuration) {
        filtered.push(suggestion);
        lastEndTime = suggestion.endTime;
      }
    }
  }

  return filtered;
}

/**
 * 离线分析 - 基于简单规则（不使用 AI）
 * 这是备选方案，当没有 API Key 时使用
 */
function offlineAnalysis(
  videoDuration: number,
  settings: SmartZoomSettings
): ZoomSuggestion[] {
  // 简单的规则：在视频的关键时间点添加缩放
  // 实际使用中可以结合鼠标数据和画面变化
  const suggestions: ZoomSuggestion[] = [];
  const interval = getIntervalByDensity(settings.density) * 4; // 离线模式间隔更大
  
  let time = interval;
  while (time < videoDuration - 2) {
    suggestions.push({
      startTime: time,
      endTime: time + 2,
      focusX: 0.5,
      focusY: 0.5,
      suggestedDepth: 3,
      reason: '自动检测的关键时间点',
      confidence: 0.5
    });
    time += interval;
  }

  return suggestions;
}

/**
 * 执行智能缩放分析
 */
export async function performSmartZoomAnalysis(
  videoElement: HTMLVideoElement,
  settings: SmartZoomSettings,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<{ success: boolean; regions: ZoomRegion[]; error?: string; cost?: string }> {
  const duration = videoElement.duration;
  
  if (!duration || duration <= 0) {
    return { success: false, regions: [], error: '视频时长无效' };
  }

  // 如果不使用 AI 或没有 API Key，使用离线分析
  if (!settings.useAI || !settings.apiKey) {
    onProgress?.({
      stage: 'processing',
      message: '使用离线模式分析...',
      percentage: 50
    });

    const suggestions = offlineAnalysis(duration, settings);
    const optimized = optimizeSuggestions(suggestions, settings.minInterval, duration);
    const regions = optimized.map(suggestionToZoomRegion);

    onProgress?.({
      stage: 'done',
      message: `离线分析完成，生成 ${regions.length} 个缩放点`,
      percentage: 100
    });

    return { success: true, regions, cost: '免费（离线模式）' };
  }

  // AI 分析流程
  try {
    // 1. 提取帧
    onProgress?.({
      stage: 'extracting',
      message: '正在提取视频帧...',
      percentage: 0
    });

    const interval = getIntervalByDensity(settings.density);
    const { estimatedCost } = estimateCost(duration, interval);

    const frames = await extractFramesFromVideo(
      videoElement,
      { intervalSeconds: interval },
      (extractionProgress) => {
        onProgress?.({
          stage: 'extracting',
          message: `正在提取帧 ${extractionProgress.current}/${extractionProgress.total}`,
          percentage: Math.round(extractionProgress.percentage * 0.4), // 提取占 40%
          extractionProgress
        });
      }
    );

    // 2. AI 分析
    onProgress?.({
      stage: 'analyzing',
      message: '正在进行 AI 分析...',
      percentage: 45
    });

    const result = await analyzeFramesWithGemini(settings.apiKey, frames, duration);

    if (!result.success) {
      onProgress?.({
        stage: 'error',
        message: result.error || '分析失败',
        percentage: 0
      });
      return { success: false, regions: [], error: result.error };
    }

    // 3. 优化建议
    onProgress?.({
      stage: 'processing',
      message: '正在优化缩放建议...',
      percentage: 80
    });

    const optimized = optimizeSuggestions(result.suggestions, settings.minInterval, duration);
    const regions = optimized.map(suggestionToZoomRegion);

    onProgress?.({
      stage: 'done',
      message: `分析完成，生成 ${regions.length} 个缩放点`,
      percentage: 100
    });

    return { 
      success: true, 
      regions, 
      cost: estimatedCost 
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    onProgress?.({
      stage: 'error',
      message: errorMessage,
      percentage: 0
    });
    return { success: false, regions: [], error: errorMessage };
  }
}

/**
 * 获取 API Key 存储
 */
export function getStoredApiKey(): string {
  try {
    return localStorage.getItem('openscreen_gemini_api_key') || '';
  } catch {
    return '';
  }
}

/**
 * 保存 API Key
 */
export function storeApiKey(apiKey: string): void {
  try {
    if (apiKey) {
      localStorage.setItem('openscreen_gemini_api_key', apiKey);
    } else {
      localStorage.removeItem('openscreen_gemini_api_key');
    }
  } catch {
    // 忽略存储错误
  }
}
