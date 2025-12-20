/**
 * 视频帧提取工具 - 从视频中提取关键帧用于智能分析
 */

import type { AnalysisFrame } from './geminiService';

export interface FrameExtractionOptions {
  intervalSeconds: number;  // 采样间隔（秒）
  maxFrames: number;        // 最大帧数
  quality: number;          // JPEG 质量 0-1
  maxWidth: number;         // 最大宽度（用于压缩）
}

const DEFAULT_OPTIONS: FrameExtractionOptions = {
  intervalSeconds: 3,
  maxFrames: 200,
  quality: 0.7,
  maxWidth: 1280
};

export interface ExtractionProgress {
  current: number;
  total: number;
  percentage: number;
}

/**
 * 从视频元素提取帧
 */
export async function extractFramesFromVideo(
  videoElement: HTMLVideoElement,
  options: Partial<FrameExtractionOptions> = {},
  onProgress?: (progress: ExtractionProgress) => void
): Promise<AnalysisFrame[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const duration = videoElement.duration;
  
  if (!duration || duration <= 0) {
    throw new Error('视频时长无效');
  }

  // 计算需要提取的帧数
  const totalFrames = Math.min(
    Math.ceil(duration / opts.intervalSeconds),
    opts.maxFrames
  );

  // 创建离屏 canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建 Canvas 上下文');
  }

  // 计算缩放后的尺寸
  const videoWidth = videoElement.videoWidth;
  const videoHeight = videoElement.videoHeight;
  const scale = Math.min(1, opts.maxWidth / videoWidth);
  canvas.width = Math.round(videoWidth * scale);
  canvas.height = Math.round(videoHeight * scale);

  const frames: AnalysisFrame[] = [];
  const originalTime = videoElement.currentTime;
  const wasPlaying = !videoElement.paused;

  // 暂停视频
  if (wasPlaying) {
    videoElement.pause();
  }

  try {
    for (let i = 0; i < totalFrames; i++) {
      const timestamp = i * opts.intervalSeconds;
      
      // 跳转到指定时间
      await seekToTime(videoElement, timestamp);
      
      // 绘制帧到 canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // 转换为 base64
      const imageBase64 = canvas.toDataURL('image/jpeg', opts.quality);
      
      frames.push({
        timestamp,
        imageBase64
      });

      // 报告进度
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: totalFrames,
          percentage: Math.round(((i + 1) / totalFrames) * 100)
        });
      }
    }
  } finally {
    // 恢复原始状态
    videoElement.currentTime = originalTime;
    if (wasPlaying) {
      videoElement.play();
    }
  }

  return frames;
}

/**
 * 跳转到指定时间并等待帧加载
 */
function seekToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('视频跳转超时'));
    }, 5000);

    const handleSeeked = () => {
      clearTimeout(timeout);
      video.removeEventListener('seeked', handleSeeked);
      // 等待一帧确保画面更新
      requestAnimationFrame(() => resolve());
    };

    video.addEventListener('seeked', handleSeeked);
    video.currentTime = Math.min(time, video.duration - 0.1);
  });
}

/**
 * 预过滤帧 - 基于画面变化检测
 * 返回变化较大的帧索引
 */
export function filterFramesByChange(
  frames: AnalysisFrame[],
  _threshold: number = 0.1
): number[] {
  if (frames.length <= 1) return frames.map((_, i) => i);

  const significantIndices: number[] = [0]; // 始终包含第一帧
  
  // 简单的变化检测：比较相邻帧
  // 实际实现中可以使用更复杂的算法
  for (let i = 1; i < frames.length; i++) {
    // 这里简化处理，实际可以计算图像差异
    // 暂时保留所有帧，后续可以优化
    significantIndices.push(i);
  }

  return significantIndices;
}

/**
 * 估算分析成本
 */
export function estimateCost(
  videoDuration: number,
  intervalSeconds: number = 3
): { frames: number; estimatedCost: string } {
  const frames = Math.ceil(videoDuration / intervalSeconds);
  // Gemini 3.0 Flash: $0.50/M input tokens
  // 每张图片约 500-1000 tokens
  const estimatedTokens = frames * 800;
  const cost = (estimatedTokens / 1_000_000) * 0.50;
  
  return {
    frames,
    estimatedCost: cost < 0.01 ? '< $0.01' : `~$${cost.toFixed(2)}`
  };
}
