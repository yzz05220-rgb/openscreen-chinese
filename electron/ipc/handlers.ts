import { ipcMain, desktopCapturer, BrowserWindow } from 'electron'
import { startMouseTracking, stopMouseTracking, getTrackingData } from './mouseTracking'
import fs from 'node:fs/promises'
import path from 'node:path'
import { RECORDINGS_DIR } from '../main'

let selectedSource: any = null

export function registerIpcHandlers(
  createEditorWindow: () => void,
  createSourceSelectorWindow: () => BrowserWindow,
  getMainWindow: () => BrowserWindow | null,
  getSourceSelectorWindow: () => BrowserWindow | null
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

  ipcMain.handle('start-mouse-tracking', () => {
    return startMouseTracking()
  })

  ipcMain.handle('stop-mouse-tracking', () => {
    return stopMouseTracking()
  })

  ipcMain.handle('store-recorded-video', async (_, videoData: ArrayBuffer, fileName: string) => {
    try {
      const videoPath = path.join(RECORDINGS_DIR, fileName)
      await fs.writeFile(videoPath, Buffer.from(videoData))
      
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

  ipcMain.handle('store-mouse-tracking-data', async (_, fileName: string) => {
    try {
      const data = getTrackingData()
      
      if (data.length === 0) {
        return { success: false, message: 'No tracking data to save' }
      }

      const trackingPath = path.join(RECORDINGS_DIR, fileName)
      await fs.writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf-8')
      
      return {
        success: true,
        path: trackingPath,
        eventCount: data.length,
        message: 'Mouse tracking data stored successfully'
      }
    } catch (error) {
      console.error('Failed to store mouse tracking data:', error)
      return {
        success: false,
        message: 'Failed to store mouse tracking data',
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
}
