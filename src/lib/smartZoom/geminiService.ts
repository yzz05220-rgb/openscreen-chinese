/**
 * Gemini API 服务 - 用于智能缩放分析
 */

export interface ZoomSuggestion {
  startTime: number;      // 秒
  endTime: number;        // 秒
  focusX: number;         // 0-1 归一化坐标
  focusY: number;         // 0-1 归一化坐标
  suggestedDepth: 1 | 2 | 3 | 4 | 5 | 6;
  reason: string;         // AI 给出的缩放理由
  confidence: number;     // 置信度 0-1
}

export interface AnalysisFrame {
  timestamp: number;      // 秒
  imageBase64: string;    // base64 编码的图片
  mousePosition?: { x: number; y: number };  // 鼠标位置（如果有）
  audioTranscript?: string;  // 音频转文字（如果有）
}

export interface SmartZoomAnalysisResult {
  success: boolean;
  suggestions: ZoomSuggestion[];
  error?: string;
  tokensUsed?: number;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * 构建分析提示词
 */
function buildAnalysisPrompt(frames: AnalysisFrame[], videoDuration: number): string {
  const frameDescriptions = frames.map((f, i) => 
    `帧 ${i + 1} (时间: ${f.timestamp.toFixed(1)}秒)${f.mousePosition ? ` [鼠标位置: ${f.mousePosition.x.toFixed(2)}, ${f.mousePosition.y.toFixed(2)}]` : ''}${f.audioTranscript ? ` [音频: "${f.audioTranscript}"]` : ''}`
  ).join('\n');

  return `你是一个专业的视频编辑助手，专门分析屏幕录制视频并识别需要缩放聚焦的重要时刻。

## 视频信息
- 总时长: ${videoDuration.toFixed(1)} 秒
- 采样帧数: ${frames.length} 帧
- 采样间隔: 约 3 秒

## 帧信息
${frameDescriptions}

## 分析任务
请分析这些屏幕录制的关键帧，识别以下需要缩放聚焦的场景：

1. **鼠标点击操作** - 用户点击按钮、链接、菜单项的位置
2. **弹窗/对话框** - 新出现的弹窗、模态框、提示框
3. **文字输入区域** - 正在输入文字的输入框、代码编辑器
4. **菜单展开** - 下拉菜单、右键菜单展开的位置
5. **重要UI变化** - 状态变化、加载完成、错误提示等
6. **音频强调** - 如果有音频转文字，注意"看这里"、"注意"、"点击"等引导词

## 输出规则
1. **密度控制**: 每分钟建议 2-4 个缩放点，不要太密集
2. **最小间隔**: 两个缩放点至少间隔 8 秒
3. **优先级**: 优先选择有明确用户操作或重要UI变化的时刻
4. **焦点位置**: focusX 和 focusY 是 0-1 的归一化坐标，(0,0) 是左上角，(1,1) 是右下角
5. **缩放深度**: 1-6 级，1 最浅(1.25x)，6 最深(5x)，一般用 2-4 级

## 输出格式
请严格按照以下 JSON 格式输出，不要包含其他文字：

{
  "suggestions": [
    {
      "startTime": 2.5,
      "endTime": 4.5,
      "focusX": 0.7,
      "focusY": 0.3,
      "suggestedDepth": 3,
      "reason": "用户点击了设置按钮",
      "confidence": 0.9
    }
  ]
}`;
}

/**
 * 调用 Gemini API 进行智能缩放分析
 */
export async function analyzeFramesWithGemini(
  apiKey: string,
  frames: AnalysisFrame[],
  videoDuration: number
): Promise<SmartZoomAnalysisResult> {
  if (!apiKey) {
    return {
      success: false,
      suggestions: [],
      error: '请先配置 Gemini API Key'
    };
  }

  if (frames.length === 0) {
    return {
      success: false,
      suggestions: [],
      error: '没有可分析的帧'
    };
  }

  try {
    const prompt = buildAnalysisPrompt(frames, videoDuration);

    // 构建请求体
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            // 添加图片
            ...frames.map(frame => ({
              inline_data: {
                mime_type: 'image/jpeg',
                data: frame.imageBase64.replace(/^data:image\/\w+;base64,/, '')
              }
            }))
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 32,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    
    // 提取文本响应
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error('API 返回格式异常');
    }

    // 解析 JSON 响应
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法解析 AI 响应');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const suggestions: ZoomSuggestion[] = (parsed.suggestions || []).map((s: any) => ({
      startTime: Number(s.startTime) || 0,
      endTime: Number(s.endTime) || 0,
      focusX: Math.max(0, Math.min(1, Number(s.focusX) || 0.5)),
      focusY: Math.max(0, Math.min(1, Number(s.focusY) || 0.5)),
      suggestedDepth: Math.max(1, Math.min(6, Number(s.suggestedDepth) || 3)) as 1 | 2 | 3 | 4 | 5 | 6,
      reason: String(s.reason || ''),
      confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0.5))
    }));

    // 获取 token 使用量
    const tokensUsed = data.usageMetadata?.totalTokenCount;

    return {
      success: true,
      suggestions,
      tokensUsed
    };

  } catch (error) {
    console.error('Gemini API 调用失败:', error);
    return {
      success: false,
      suggestions: [],
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 验证 API Key 是否有效
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello' }] }],
        generationConfig: { maxOutputTokens: 10 }
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}
