"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getSources: async (opts) => {
    return await electron.ipcRenderer.invoke("get-sources", opts);
  },
  switchToEditor: () => {
    return electron.ipcRenderer.invoke("switch-to-editor");
  },
  openSourceSelector: () => {
    return electron.ipcRenderer.invoke("open-source-selector");
  },
  selectSource: (source) => {
    return electron.ipcRenderer.invoke("select-source", source);
  },
  getSelectedSource: () => {
    return electron.ipcRenderer.invoke("get-selected-source");
  },
  startMouseTracking: () => {
    return electron.ipcRenderer.invoke("start-mouse-tracking");
  },
  stopMouseTracking: () => {
    return electron.ipcRenderer.invoke("stop-mouse-tracking");
  },
  storeRecordedVideo: (videoData, fileName) => {
    return electron.ipcRenderer.invoke("store-recorded-video", videoData, fileName);
  },
  storeMouseTrackingData: (fileName) => {
    return electron.ipcRenderer.invoke("store-mouse-tracking-data", fileName);
  },
  getRecordedVideoPath: () => {
    return electron.ipcRenderer.invoke("get-recorded-video-path");
  }
});
