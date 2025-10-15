import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: async (opts: Electron.SourcesOptions) => {
    return await ipcRenderer.invoke('get-sources', opts)
  },
  switchToEditor: () => {
    return ipcRenderer.invoke('switch-to-editor')
  },
  openSourceSelector: () => {
    return ipcRenderer.invoke('open-source-selector')
  },
  selectSource: (source: any) => {
    return ipcRenderer.invoke('select-source', source)
  },
  getSelectedSource: () => {
    return ipcRenderer.invoke('get-selected-source')
  },
  startMouseTracking: () => {
    return ipcRenderer.invoke('start-mouse-tracking')
  },
  stopMouseTracking: () => {
    return ipcRenderer.invoke('stop-mouse-tracking')
  },
  storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => {
    return ipcRenderer.invoke('store-recorded-video', videoData, fileName)
  },
  storeMouseTrackingData: (fileName: string) => {
    return ipcRenderer.invoke('store-mouse-tracking-data', fileName)
  },
  getRecordedVideoPath: () => {
    return ipcRenderer.invoke('get-recorded-video-path')
  }
})