/// <reference types="vite/client" />
/// <reference types="../electron/electron-env" />

interface ProcessedDesktopSource {
  id: string;
  name: string;
  display_id: string;
  thumbnail: string | null;
  appIcon: string | null;
}

interface Window {
  electronAPI: {
    ipcRenderer: {
      send: (channel: string, ...args: any[]) => void
    }
    getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>
    switchToEditor: () => Promise<void>
    openSourceSelector: () => Promise<void>
    selectSource: (source: any) => Promise<any>
    getSelectedSource: () => Promise<any>
    storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{
      success: boolean
      path?: string
      message: string
      error?: string
    }>
    getRecordedVideoPath: () => Promise<{
      success: boolean
      path?: string
      message?: string
      error?: string
    }>
    getAssetBasePath: () => Promise<string | null>
    setRecordingState: (recording: boolean) => Promise<void>
    onStopRecordingFromTray: (callback: () => void) => () => void
    onPauseRecordingFromTray: (callback: () => void) => () => void
    onGlobalShortcut: (callback: (action: string) => void) => () => void
    getShortcutSettings: () => Promise<{ stopRecording: string; pauseRecording: string }>
    setShortcutSettings: (settings: { stopRecording: string; pauseRecording: string }) => Promise<{ success: boolean }>
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
    openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
    saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{
      success: boolean
      path?: string
      message?: string
      cancelled?: boolean
    }>
    openVideoFilePicker: () => Promise<{ success: boolean; path?: string; cancelled?: boolean }>
    setCurrentVideoPath: (path: string) => Promise<{ success: boolean }>
    getCurrentVideoPath: () => Promise<{ success: boolean; path?: string }>
    clearCurrentVideoPath: () => Promise<{ success: boolean }>
    getPlatform: () => Promise<string>
    getMouseData: (videoPath: string) => Promise<{
      success: boolean
      data?: {
        version: number
        frameRate: number
        positions: Array<{ time: number; x: number; y: number }>
      } | null
      message?: string
      error?: string
    }>
    hudOverlayHide: () => void
    hudOverlayClose: () => void
    resizeOverlay: (width: number, height: number) => Promise<{ success: boolean }>
  }
}