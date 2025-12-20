/**
 * 鼠标位置追踪工具
 * 用于加载和查询录制时保存的鼠标位置数据
 */

export interface MousePosition {
  time: number;  // 毫秒
  x: number;     // 屏幕坐标
  y: number;     // 屏幕坐标
}

export interface MouseData {
  version: number;
  frameRate: number;
  positions: MousePosition[];
}

export interface NormalizedMousePosition {
  cx: number;  // 归一化坐标 0-1
  cy: number;  // 归一化坐标 0-1
}

/**
 * 加载视频对应的鼠标数据
 */
export async function loadMouseData(videoPath: string): Promise<MouseData | null> {
  try {
    const result = await window.electronAPI.getMouseData(videoPath);
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  } catch (error) {
    console.error('Failed to load mouse data:', error);
    return null;
  }
}

/**
 * 根据时间获取鼠标位置（线性插值）
 */
export function getMousePositionAtTime(
  mouseData: MouseData,
  timeMs: number,
  videoWidth: number,
  videoHeight: number
): NormalizedMousePosition | null {
  const { positions } = mouseData;
  
  if (positions.length === 0) {
    return null;
  }
  
  // 找到时间点前后的两个位置
  let beforeIndex = -1;
  let afterIndex = -1;
  
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].time <= timeMs) {
      beforeIndex = i;
    }
    if (positions[i].time >= timeMs && afterIndex === -1) {
      afterIndex = i;
      break;
    }
  }
  
  // 如果没有找到，使用边界值
  if (beforeIndex === -1) {
    beforeIndex = 0;
  }
  if (afterIndex === -1) {
    afterIndex = positions.length - 1;
  }
  
  const before = positions[beforeIndex];
  const after = positions[afterIndex];
  
  let x: number, y: number;
  
  if (beforeIndex === afterIndex || before.time === after.time) {
    // 精确匹配或只有一个点
    x = before.x;
    y = before.y;
  } else {
    // 线性插值
    const t = (timeMs - before.time) / (after.time - before.time);
    x = before.x + (after.x - before.x) * t;
    y = before.y + (after.y - before.y) * t;
  }
  
  // 归一化到 0-1 范围
  // 注意：录制时的坐标是屏幕坐标，需要转换为视频坐标
  // 这里假设视频尺寸就是录制时的屏幕尺寸
  return {
    cx: Math.max(0, Math.min(1, x / videoWidth)),
    cy: Math.max(0, Math.min(1, y / videoHeight)),
  };
}

/**
 * 存储鼠标数据到本地（用于 AI 分析结果）
 */
export function storeMouseDataLocally(key: string, data: MouseData): void {
  try {
    localStorage.setItem(`mouse_data_${key}`, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to store mouse data locally:', error);
  }
}

/**
 * 从本地获取鼠标数据
 */
export function getMouseDataLocally(key: string): MouseData | null {
  try {
    const data = localStorage.getItem(`mouse_data_${key}`);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Failed to get mouse data locally:', error);
    return null;
  }
}
