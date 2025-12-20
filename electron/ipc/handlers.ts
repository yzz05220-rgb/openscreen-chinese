import { ipcMain, desktopCapturer, BrowserWindow, shell, app, dialog, screen } from 'electron'

import fs from 'node:fs/promises'
import path from 'node:path'
import { RECORDINGS_DIR } from '../main'

let selectedSource: any = null
let mouseTrackingInterval: NodeJS.Timeout | null = null
let mousePositions: Array<{ time: number; x: number; y: number }> = []
let mouseTrackingStartTime: number = 0
let recordingSourceBounds: { x: number; y: number; width: number; height: number } | null = null

export function registerIpcHandlers(
  createEditorWindow: () => void,
  createSourceSelectorWindow: () => BrowserWindow,
  getMainWindow: () => BrowserWindow | null,
  getSourceSelectorWindow: () => BrowserWindow | null,
  onRecordingStateChange?: (recording: boolean, sourceName: string) => void
) {
  ipcMain.handle('get-sources', async (_, opts) => {
    const sources = await desktopCapturer.getSources(opts)
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }))
  })

  ipcMain.handle('select-source', (_, source) => {
    selectedSource = source
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.close()
    }
    return selectedSource
  })

  ipcMain.handle('get-selected-source', () => {
    return selectedSource
  })

  ipcMain.handle('open-source-selector', () => {
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.focus()
      return
    }
    createSourceSelectorWindow()
  })

  ipcMain.handle('switch-to-editor', () => {
    const mainWin = getMainWindow()
    if (mainWin) {
      mainWin.close()
    }
    createEditorWindow()
  })



  ipcMain.handle('store-recorded-video', async (_, videoData: ArrayBuffer, fileName: string) => {
    try {
      const videoPath = path.join(RECORDINGS_DIR, fileName)
      await fs.writeFile(videoPath, Buffer.from(videoData))
      currentVideoPath = videoPath;
      
      // 保存鼠标位置数据
      if (mousePositions.length > 0) {
        const mouseDataFileName = fileName.replace(/\.[^.]+$/, '.mouse.json')
        const mouseDataPath = path.join(RECORDINGS_DIR, mouseDataFileName)
        await fs.writeFile(mouseDataPath, JSON.stringify({
          version: 1,
          frameRate: 30,
          positions: mousePositions
        }))
        console.log(`Mouse data saved: ${mousePositions.length} positions`)
        mousePositions = [] // 清空数据
      }
      
      return {
        success: true,
        path: videoPath,
        message: 'Video stored successfully'
      }
    } catch (error) {
      console.error('Failed to store video:', error)
      return {
        success: false,
        message: 'Failed to store video',
        error: String(error)
      }
    }
  })



  ipcMain.handle('get-recorded-video-path', async () => {
    try {
      const files = await fs.readdir(RECORDINGS_DIR)
      const videoFiles = files.filter(file => file.endsWith('.webm'))
      
      if (videoFiles.length === 0) {
        return { success: false, message: 'No recorded video found' }
      }
      
      const latestVideo = videoFiles.sort().reverse()[0]
      const videoPath = path.join(RECORDINGS_DIR, latestVideo)
      
      return { success: true, path: videoPath }
    } catch (error) {
      console.error('Failed to get video path:', error)
      return { success: false, message: 'Failed to get video path', error: String(error) }
    }
  })

  ipcMain.handle('set-recording-state', (_, recording: boolean) => {
    const source = selectedSource || { name: 'Screen' }
    if (onRecordingStateChange) {
      onRecordingStateChange(recording, source.name)
    }
    
    // 鼠标位置追踪
    if (recording) {
      // 开始录制时，获取录制源的边界
      // 对于全屏录制，获取显示器边界
      // 对于窗口录制，需要从 source 获取窗口位置
      recordingSourceBounds = null
      
      if (selectedSource) {
        // 检查是否是显示器录制
        if (selectedSource.display_id) {
          const displays = screen.getAllDisplays()
          const targetDisplay = displays.find(d => String(d.id) === selectedSource.display_id)
          if (targetDisplay) {
            recordingSourceBounds = targetDisplay.bounds
          }
        }
        
        // 如果没有找到显示器边界，使用主显示器
        if (!recordingSourceBounds) {
          const primaryDisplay = screen.getPrimaryDisplay()
          recordingSourceBounds = primaryDisplay.bounds
        }
      }
      
      mousePositions = []
      mouseTrackingStartTime = Date.now()
      
      // 每 33ms 记录一次鼠标位置（约 30fps）
      mouseTrackingInterval = setInterval(() => {
        const cursorPos = screen.getCursorScreenPoint()
        const time = Date.now() - mouseTrackingStartTime
        
        // 将屏幕坐标转换为相对于录制区域的坐标
        let relativeX = cursorPos.x
        let relativeY = cursorPos.y
        
        if (recordingSourceBounds) {
          relativeX = cursorPos.x - recordingSourceBounds.x
          relativeY = cursorPos.y - recordingSourceBounds.y
        }
        
        mousePositions.push({
          time,
          x: relativeX,
          y: relativeY
        })
      }, 33)
    } else {
      // 停止录制时，停止鼠标追踪
      if (mouseTrackingInterval) {
        clearInterval(mouseTrackingInterval)
        mouseTrackingInterval = null
      }
      recordingSourceBounds = null
    }
  })


  ipcMain.handle('open-external-url', async (_, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('Failed to open URL:', error)
      return { success: false, error: String(error) }
    }
  })

  // Return base path for assets so renderer can resolve file:// paths in production
  ipcMain.handle('get-asset-base-path', () => {
    try {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, 'assets')
      }
      return path.join(app.getAppPath(), 'public', 'assets')
    } catch (err) {
      console.error('Failed to resolve asset base path:', err)
      return null
    }
  })

  ipcMain.handle('save-exported-video', async (_, videoData: ArrayBuffer, fileName: string) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Save Exported Video',
        defaultPath: path.join(app.getPath('downloads'), fileName),
        filters: [
          { name: 'MP4 Video', extensions: ['mp4'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          cancelled: true,
          message: 'Export cancelled'
        };
      }
      await fs.writeFile(result.filePath, Buffer.from(videoData));
      
      return {
        success: true,
        path: result.filePath,
        message: 'Video exported successfully'
      };
    } catch (error) {
      console.error('Failed to save exported video:', error)
      return {
        success: false,
        message: 'Failed to save exported video',
        error: String(error)
      }
    }
  })

  ipcMain.handle('open-video-file-picker', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Video File',
        defaultPath: RECORDINGS_DIR,
        filters: [
          { name: 'Video Files', extensions: ['webm', 'mp4', 'mov', 'avi', 'mkv'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }

      return {
        success: true,
        path: result.filePaths[0]
      };
    } catch (error) {
      console.error('Failed to open file picker:', error);
      return {
        success: false,
        message: 'Failed to open file picker',
        error: String(error)
      };
    }
  });

  let currentVideoPath: string | null = null;

  ipcMain.handle('set-current-video-path', (_, path: string) => {
    currentVideoPath = path;
    return { success: true };
  });

  ipcMain.handle('get-current-video-path', () => {
    return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
  });

  ipcMain.handle('clear-current-video-path', () => {
    currentVideoPath = null;
    return { success: true };
  });

  ipcMain.handle('get-platform', () => {
    return process.platform;
  });

  // 获取视频对应的鼠标位置数据
  ipcMain.handle('get-mouse-data', async (_, videoPath: string) => {
    try {
      // 从视频路径推断鼠标数据文件路径
      const mouseDataPath = videoPath.replace(/\.[^.]+$/, '.mouse.json')
      
      try {
        const data = await fs.readFile(mouseDataPath, 'utf-8')
        const mouseData = JSON.parse(data)
        return {
          success: true,
          data: mouseData
        }
      } catch (readError) {
        // 文件不存在，返回空数据
        return {
          success: true,
          data: null,
          message: 'No mouse data found for this video'
        }
      }
    } catch (error) {
      console.error('Failed to get mouse data:', error)
      return {
        success: false,
        message: 'Failed to get mouse data',
        error: String(error)
      }
    }
  });
}
