/**
 * Gemini 3 Pro Image (Nano Banana Pro) API 服务 - 用于 AI 图像生成
 * 
 * 模型: gemini-3-pro-image-preview (aka Nano Banana Pro)
 * 支持: 文生图、图生图
 * 分辨率: 2K (效率), 4K (质量)
 */

export interface ImageGenResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
}

export type ImageQuality = 'efficiency' | 'quality';

const GEMINI_IMAGE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';

export function getStoredApiKey(): string | null {
  return localStorage.getItem('openscreen_gemini_api_key');
}

export function hasApiKey(): boolean {
  return !!getStoredApiKey();
}

export async function generateImageFromText(
  prompt: string,
  quality?: ImageQuality | string,
  apiKey?: string
): Promise<ImageGenResult> {
  const key = apiKey;
  const q = (quality === 'quality' || quality === 'efficiency') ? quality : 'efficiency';
  
  if (!key) {
    return { success: false, error: '请先输入 API Key' };
  }

  if (!prompt.trim()) {
    return { success: false, error: '请输入图片描述' };
  }

  try {
    const imageSize = q === 'quality' ? '4K' : '2K';
    
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '1:1', imageSize }
      }
    };

    const response = await fetch(`${GEMINI_IMAGE_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        return {
          success: true,
          imageBase64: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        };
      }
    }

    throw new Error('API 未返回图片');
  } catch (error) {
    console.error('Gemini 3 Pro Image API 调用失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '图像生成失败' };
  }
}

export async function generateImageFromReference(
  prompt: string,
  referenceImageBase64: string,
  quality?: ImageQuality | string,
  apiKey?: string
): Promise<ImageGenResult> {
  const key = apiKey;
  const q = (quality === 'quality' || quality === 'efficiency') ? quality : 'efficiency';
  
  if (!key) {
    return { success: false, error: '请先输入 API Key' };
  }

  if (!prompt.trim()) {
    return { success: false, error: '请输入图片描述' };
  }

  try {
    const imageSize = q === 'quality' ? '4K' : '2K';
    const base64Match = referenceImageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    const mimeType = base64Match?.[1] || 'image/png';
    const base64Data = base64Match?.[2] || referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
    
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '1:1', imageSize }
      }
    };

    const response = await fetch(`${GEMINI_IMAGE_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        return {
          success: true,
          imageBase64: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        };
      }
    }

    throw new Error('API 未返回图片');
  } catch (error) {
    console.error('图生图失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '图像生成失败' };
  }
}
