import { createRequire } from 'node:module'
import type { BrowserWindow as BrowserWindowType } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const electronModule = require('electron')
console.log('Electron module keys:', Object.keys(electronModule))
console.log('ipcMain:', electronModule.ipcMain)
const { BrowserWindow: BrowserWindowConstructor, screen, ipcMain } = electronModule
const BrowserWindow = BrowserWindowConstructor


const __dirname = path.dirname(fileURLToPath(import.meta.url))

const APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const RENDERER_DIST = path.join(APP_ROOT, 'dist')

let hudOverlayWindow: BrowserWindowType | null = null;

ipcMain.on('hud-overlay-hide', () => {
  if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
    hudOverlayWindow.minimize();
  }
});

// 设置点击穿透（让透明区域可以点击到下面的内容）
ipcMain.on('set-ignore-mouse-events', (_event: unknown, ignore: boolean, options?: { forward: boolean }) => {
  if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
    hudOverlayWindow.setIgnoreMouseEvents(ignore, options);
  }
});

export function createHudOverlayWindow(): BrowserWindowType {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  // 窗口高度需要足够容纳工具栏和向上弹出的面板
  const windowWidth = 500;
  const windowHeight = 350; // 350px 高度，工具栏在中下部，上方留出空间给弹出面板

  const x = Math.floor(workArea.x + (workArea.width - windowWidth) / 2);
  // 窗口底部距离屏幕底部 60px，这样工具栏看起来在屏幕底部附近
  const y = Math.floor(workArea.y + workArea.height - windowHeight - 60);

  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 500,
    maxWidth: 500,
    minHeight: 350,
    maxHeight: 350,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  })


  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  hudOverlayWindow = win;

  win.on('closed', () => {
    if (hudOverlayWindow === win) {
      hudOverlayWindow = null;
    }
  });


  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + '?windowType=hud-overlay')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      query: { windowType: 'hud-overlay' }
    })
  }

  return win
}

export function createEditorWindow(): BrowserWindowType {
  const isMac = process.platform === 'darwin';
  const isWindows = process.platform === 'win32';

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...(isMac && {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 12 },
    }),
    // Windows: 隐藏菜单栏，使用自定义标题栏
    ...(isWindows && {
      autoHideMenuBar: true,
    }),
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: 'OpenScreen',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false,
    },
  })

  // Maximize the window by default
  win.maximize();

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + '?windowType=editor')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      query: { windowType: 'editor' }
    })
  }

  return win
}

export function createSourceSelectorWindow(): BrowserWindowType {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((width - 620) / 2),
    y: Math.round((height - 420) / 2),
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + '?windowType=source-selector')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      query: { windowType: 'source-selector' }
    })
  }

  return win
}
