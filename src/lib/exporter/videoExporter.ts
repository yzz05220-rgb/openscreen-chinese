import type { ExportConfig, ExportProgress, ExportResult } from './types';
import { VideoFileDecoder } from './videoDecoder';
import { FrameRenderer } from './frameRenderer';
import { VideoMuxer } from './muxer';
import type { ZoomRegion, CropRegion, TrimRegion, AnnotationRegion } from '@/components/video-editor/types';

interface VideoExporterConfig extends ExportConfig {
  videoUrl: string;
  wallpaper: string;
  zoomRegions: ZoomRegion[];
  trimRegions?: TrimRegion[];
  showShadow: boolean;
  shadowIntensity: number;
  showBlur: boolean;
  motionBlurEnabled?: boolean;
  borderRadius?: number;
  padding?: number;
  videoPadding?: number;
  cropRegion: CropRegion;
  annotationRegions?: AnnotationRegion[];
  previewWidth?: number;
  previewHeight?: number;
  onProgress?: (progress: ExportProgress) => void;
}

// 表示一个连续播放的时间段（不被 trim 打断）
interface ContinuousSegment {
  sourceStartMs: number;
  sourceEndMs: number;
  effectiveStartMs: number;
  effectiveEndMs: number;
}

export class VideoExporter {
  private config: VideoExporterConfig;
  private decoder: VideoFileDecoder | null = null;
  private renderer: FrameRenderer | null = null;
  private encoder: VideoEncoder | null = null;
  private muxer: VideoMuxer | null = null;
  private cancelled = false;
  private encodeQueue = 0;
  // 增大队列以充分利用 GPU 硬件编码
  private readonly MAX_ENCODE_QUEUE = 200;
  private videoDescription: Uint8Array | undefined;
  private videoColorSpace: VideoColorSpaceInit | undefined;
  private muxingPromises: Promise<void>[] = [];
  private chunkCount = 0;

  constructor(config: VideoExporterConfig) {
    this.config = config;
  }

  // 计算连续播放的时间段（不被 trim 打断的区域）
  private computeContinuousSegments(totalDurationMs: number): ContinuousSegment[] {
    const trimRegions = this.config.trimRegions || [];
    const sortedTrims = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
    
    const segments: ContinuousSegment[] = [];
    let currentSourceMs = 0;
    let currentEffectiveMs = 0;
    
    for (const trim of sortedTrims) {
      if (trim.startMs > currentSourceMs) {
        const segmentDuration = trim.startMs - currentSourceMs;
        segments.push({
          sourceStartMs: currentSourceMs,
          sourceEndMs: trim.startMs,
          effectiveStartMs: currentEffectiveMs,
          effectiveEndMs: currentEffectiveMs + segmentDuration,
        });
        currentEffectiveMs += segmentDuration;
      }
      currentSourceMs = trim.endMs;
    }
    
    if (currentSourceMs < totalDurationMs) {
      const segmentDuration = totalDurationMs - currentSourceMs;
      segments.push({
        sourceStartMs: currentSourceMs,
        sourceEndMs: totalDurationMs,
        effectiveStartMs: currentEffectiveMs,
        effectiveEndMs: currentEffectiveMs + segmentDuration,
      });
    }
    
    return segments;
  }

  private getEffectiveDuration(totalDuration: number): number {
    const trimRegions = this.config.trimRegions || [];
    const totalTrimDuration = trimRegions.reduce((sum, region) => {
      return sum + (region.endMs - region.startMs) / 1000;
    }, 0);
    return totalDuration - totalTrimDuration;
  }

  async export(): Promise<ExportResult> {
    try {
      this.cleanup();
      this.cancelled = false;

      // Initialize decoder and load video
      this.decoder = new VideoFileDecoder();
      const videoInfo = await this.decoder.loadVideo(this.config.videoUrl);

      // Initialize frame renderer
      this.renderer = new FrameRenderer({
        width: this.config.width,
        height: this.config.height,
        wallpaper: this.config.wallpaper,
        zoomRegions: this.config.zoomRegions,
        showShadow: this.config.showShadow,
        shadowIntensity: this.config.shadowIntensity,
        showBlur: this.config.showBlur,
        motionBlurEnabled: this.config.motionBlurEnabled,
        borderRadius: this.config.borderRadius,
        padding: this.config.padding,
        cropRegion: this.config.cropRegion,
        videoWidth: videoInfo.width,
        videoHeight: videoInfo.height,
        annotationRegions: this.config.annotationRegions,
        previewWidth: this.config.previewWidth,
        previewHeight: this.config.previewHeight,
      });
      await this.renderer.initialize();

      // Initialize video encoder with optimized settings
      await this.initializeEncoder();

      // Initialize muxer
      this.muxer = new VideoMuxer(this.config, false);
      await this.muxer.initialize();

      const videoElement = this.decoder.getVideoElement();
      if (!videoElement) {
        throw new Error('Video element not available');
      }

      // 预加载视频
      videoElement.preload = 'auto';
      
      const effectiveDuration = this.getEffectiveDuration(videoInfo.duration);
      const totalFrames = Math.ceil(effectiveDuration * this.config.frameRate);
      
      console.log('[VideoExporter] Original duration:', videoInfo.duration, 's');
      console.log('[VideoExporter] Effective duration:', effectiveDuration, 's');
      console.log('[VideoExporter] Total frames:', totalFrames);
      console.log('[VideoExporter] Frame rate:', this.config.frameRate);

      const segments = this.computeContinuousSegments(videoInfo.duration * 1000);
      console.log('[VideoExporter] Segments:', segments.length);

      const frameDuration = 1_000_000 / this.config.frameRate;
      const frameIntervalMs = 1000 / this.config.frameRate;
      let globalFrameIndex = 0;

      const startTime = performance.now();

      // 处理每个连续段 - 使用视频播放模式
      for (const segment of segments) {
        if (this.cancelled) break;

        const segmentFrames = Math.ceil((segment.effectiveEndMs - segment.effectiveStartMs) / frameIntervalMs);
        console.log(`[VideoExporter] Segment: ${segment.sourceStartMs}ms - ${segment.sourceEndMs}ms (${segmentFrames} frames)`);

        // Seek 到段起始
        await this.seekToTime(videoElement, segment.sourceStartMs / 1000);

        // 使用快速播放模式提取帧
        const framesProcessed = await this.extractFramesWithPlayback(
          videoElement,
          segment,
          segmentFrames,
          frameIntervalMs,
          frameDuration,
          globalFrameIndex,
          totalFrames,
          startTime
        );
        
        globalFrameIndex += framesProcessed;
      }

      if (this.cancelled) {
        return { success: false, error: 'Export cancelled' };
      }

      // Finalize
      if (this.encoder && this.encoder.state === 'configured') {
        await this.encoder.flush();
      }

      await Promise.all(this.muxingPromises);
      const blob = await this.muxer!.finalize();

      const totalTime = (performance.now() - startTime) / 1000;
      console.log(`[VideoExporter] Completed in ${totalTime.toFixed(2)}s (${(totalFrames / totalTime).toFixed(1)} fps)`);

      return { success: true, blob };
    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.cleanup();
    }
  }

  private async seekToTime(videoElement: HTMLVideoElement, time: number): Promise<void> {
    return new Promise<void>(resolve => {
      const onSeeked = () => {
        videoElement.removeEventListener('seeked', onSeeked);
        resolve();
      };
      videoElement.addEventListener('seeked', onSeeked);
      videoElement.currentTime = time;
    });
  }

  // 使用视频播放模式快速提取帧
  private async extractFramesWithPlayback(
    videoElement: HTMLVideoElement,
    segment: ContinuousSegment,
    segmentFrames: number,
    frameIntervalMs: number,
    frameDuration: number,
    startGlobalFrameIndex: number,
    totalFrames: number,
    exportStartTime: number
  ): Promise<number> {
    return new Promise<number>((resolve) => {
      let framesProcessed = 0;
      let globalFrameIndex = startGlobalFrameIndex;
      let lastCapturedTimeMs = segment.sourceStartMs - frameIntervalMs;
      let lastActivityTime = performance.now();
      let timeoutCheckId: number | null = null;
      let progressCheckId: number | null = null;
      let isFinished = false;
      let lastProgressTime = 0;
      let stuckCount = 0;
      
      // 加速播放
      const playbackRate = 2.0;
      videoElement.playbackRate = playbackRate;
      
      const segmentEndTimeMs = segment.sourceEndMs;
      
      const finish = () => {
        if (isFinished) return;
        isFinished = true;
        
        if (timeoutCheckId) {
          clearInterval(timeoutCheckId);
          timeoutCheckId = null;
        }
        if (progressCheckId) {
          clearInterval(progressCheckId);
          progressCheckId = null;
        }
        videoElement.pause();
        videoElement.playbackRate = 1.0;
        videoElement.removeEventListener('ended', onEnded);
        console.log(`[VideoExporter] Segment finished: ${framesProcessed} frames processed`);
        resolve(framesProcessed);
      };
      
      // 超时检测 - 如果 1 秒没有新帧，认为播放结束
      timeoutCheckId = window.setInterval(() => {
        const timeSinceActivity = performance.now() - lastActivityTime;
        if (timeSinceActivity > 1000) {
          console.log('[VideoExporter] Timeout detected (1s no activity), finishing segment');
          finish();
        }
      }, 300);
      
      // 进度检测 - 检查视频是否卡住
      progressCheckId = window.setInterval(() => {
        const currentTimeMs = videoElement.currentTime * 1000;
        if (Math.abs(currentTimeMs - lastProgressTime) < 10) {
          stuckCount++;
          if (stuckCount >= 3) {
            console.log('[VideoExporter] Video playback stuck, finishing segment');
            finish();
          }
        } else {
          stuckCount = 0;
        }
        lastProgressTime = currentTimeMs;
        
        // 检查是否已经超过段结束时间
        if (currentTimeMs >= segmentEndTimeMs - 50) {
          console.log('[VideoExporter] Reached segment end time, finishing');
          finish();
        }
      }, 200);
      
      // 监听视频结束事件
      const onEnded = () => {
        console.log('[VideoExporter] Video ended event');
        finish();
      };
      videoElement.addEventListener('ended', onEnded, { once: true });
      
      const processFrame = async () => {
        if (isFinished || this.cancelled) {
          finish();
          return;
        }
        
        lastActivityTime = performance.now();
        
        const currentTimeMs = videoElement.currentTime * 1000;
        
        // 检查是否完成 - 更宽松的条件
        if (currentTimeMs >= segmentEndTimeMs - 50 || framesProcessed >= segmentFrames) {
          console.log(`[VideoExporter] Segment complete: ${framesProcessed}/${segmentFrames} frames, time: ${currentTimeMs.toFixed(0)}/${segmentEndTimeMs}`);
          finish();
          return;
        }
        
        const timeSinceLastCapture = currentTimeMs - lastCapturedTimeMs;
        
        // 当达到帧间隔时捕获
        if (timeSinceLastCapture >= frameIntervalMs * 0.7) {
          const timestamp = globalFrameIndex * frameDuration;
          const sourceTimestamp = currentTimeMs * 1000;
          
          try {
            const videoFrame = new VideoFrame(videoElement, { timestamp });
            await this.renderer!.renderFrame(videoFrame, sourceTimestamp);
            videoFrame.close();

            const canvas = this.renderer!.getCanvas();
            // @ts-ignore
            const exportFrame = new VideoFrame(canvas, {
              timestamp,
              duration: frameDuration,
              colorSpace: {
                primaries: 'bt709',
                transfer: 'iec61966-2-1',
                matrix: 'rgb',
                fullRange: true,
              },
            });

            // 等待编码队列有空间 - 减少等待时间
            let waitCount = 0;
            while (this.encodeQueue >= this.MAX_ENCODE_QUEUE && !this.cancelled && waitCount < 50) {
              await new Promise(r => setTimeout(r, 1));
              waitCount++;
            }
            
            // 如果等待太久，跳过这一帧
            if (waitCount >= 50) {
              console.warn('[VideoExporter] Encode queue full, skipping frame');
              exportFrame.close();
            } else if (this.encoder && this.encoder.state === 'configured') {
              this.encodeQueue++;
              this.encoder.encode(exportFrame, { keyFrame: globalFrameIndex % 60 === 0 });
              exportFrame.close();
            } else {
              exportFrame.close();
            }

            lastCapturedTimeMs = currentTimeMs;
            framesProcessed++;
            globalFrameIndex++;

            // 更新进度
            if (this.config.onProgress && framesProcessed % 3 === 0) {
              const elapsed = (performance.now() - exportStartTime) / 1000;
              const fps = globalFrameIndex / elapsed;
              const remaining = (totalFrames - globalFrameIndex) / fps;
              
              this.config.onProgress({
                currentFrame: globalFrameIndex,
                totalFrames,
                percentage: (globalFrameIndex / totalFrames) * 100,
                estimatedTimeRemaining: remaining,
              });
            }
          } catch (e) {
            console.warn('[VideoExporter] Frame capture error:', e);
          }
        }
        
        // 继续下一帧
        if (!isFinished) {
          if ('requestVideoFrameCallback' in videoElement) {
            (videoElement as any).requestVideoFrameCallback(processFrame);
          } else {
            requestAnimationFrame(processFrame);
          }
        }
      };
      
      // 开始播放
      if ('requestVideoFrameCallback' in videoElement) {
        (videoElement as any).requestVideoFrameCallback(processFrame);
      } else {
        requestAnimationFrame(processFrame);
      }
      
      videoElement.play().catch(e => {
        console.error('[VideoExporter] Play error:', e);
        finish();
      });
    });
  }

  private async initializeEncoder(): Promise<void> {
    this.encodeQueue = 0;
    this.muxingPromises = [];
    this.chunkCount = 0;
    let videoDescription: Uint8Array | undefined;

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (meta?.decoderConfig?.description && !videoDescription) {
          const desc = meta.decoderConfig.description;
          videoDescription = new Uint8Array(desc instanceof ArrayBuffer ? desc : (desc as any));
          this.videoDescription = videoDescription;
        }
        if (meta?.decoderConfig?.colorSpace && !this.videoColorSpace) {
          this.videoColorSpace = meta.decoderConfig.colorSpace;
        }

        const isFirstChunk = this.chunkCount === 0;
        this.chunkCount++;

        const muxingPromise = (async () => {
          try {
            if (isFirstChunk && this.videoDescription) {
              const colorSpace = this.videoColorSpace || {
                primaries: 'bt709',
                transfer: 'iec61966-2-1',
                matrix: 'rgb',
                fullRange: true,
              };

              const metadata: EncodedVideoChunkMetadata = {
                decoderConfig: {
                  codec: this.config.codec || 'avc1.640033',
                  codedWidth: this.config.width,
                  codedHeight: this.config.height,
                  description: this.videoDescription,
                  colorSpace,
                },
              };

              await this.muxer!.addVideoChunk(chunk, metadata);
            } else {
              await this.muxer!.addVideoChunk(chunk, meta);
            }
          } catch (error) {
            console.error('Muxing error:', error);
          }
        })();

        this.muxingPromises.push(muxingPromise);
        this.encodeQueue--;
      },
      error: (error) => {
        console.error('[VideoExporter] Encoder error:', error);
        this.cancelled = true;
      },
    });

    const codec = this.config.codec || 'avc1.640033';
    
    // 优化编码器配置 - 使用 realtime 模式获得最快速度
    const encoderConfig: VideoEncoderConfig = {
      codec,
      width: this.config.width,
      height: this.config.height,
      bitrate: this.config.bitrate,
      framerate: this.config.frameRate,
      latencyMode: 'realtime', // realtime 模式最快
      bitrateMode: 'variable',
      hardwareAcceleration: 'prefer-hardware',
    };

    // 尝试硬件加速
    const hardwareSupport = await VideoEncoder.isConfigSupported(encoderConfig);

    if (hardwareSupport.supported) {
      console.log('[VideoExporter] ✓ Hardware acceleration enabled');
      this.encoder.configure(encoderConfig);
    } else {
      console.log('[VideoExporter] Hardware not available, using software');
      encoderConfig.hardwareAcceleration = 'prefer-software';
      
      const softwareSupport = await VideoEncoder.isConfigSupported(encoderConfig);
      if (!softwareSupport.supported) {
        throw new Error('Video encoding not supported');
      }
      
      this.encoder.configure(encoderConfig);
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.encoder) {
      try {
        if (this.encoder.state === 'configured') {
          this.encoder.close();
        }
      } catch (e) {
        console.warn('Error closing encoder:', e);
      }
      this.encoder = null;
    }

    if (this.decoder) {
      try {
        this.decoder.destroy();
      } catch (e) {
        console.warn('Error destroying decoder:', e);
      }
      this.decoder = null;
    }

    if (this.renderer) {
      try {
        this.renderer.destroy();
      } catch (e) {
        console.warn('Error destroying renderer:', e);
      }
      this.renderer = null;
    }

    this.muxer = null;
    this.encodeQueue = 0;
    this.muxingPromises = [];
    this.chunkCount = 0;
    this.videoDescription = undefined;
    this.videoColorSpace = undefined;
  }
}
