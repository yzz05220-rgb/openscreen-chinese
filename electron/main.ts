import { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createHudOverlayWindow, createEditorWindow, createSourceSelectorWindow } from './windows'
import { registerIpcHandlers } from './ipc/handlers'


const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const RECORDINGS_DIR = path.join(app.getPath('userData'), 'recordings')

// 快捷键设置
interface ShortcutSettings {
  stopRecording: string;
  pauseRecording: string;
}

const DEFAULT_SHORTCUTS: ShortcutSettings = {
  stopRecording: 'CommandOrControl+Shift+S',
  pauseRecording: 'CommandOrControl+Shift+P'
};

let currentShortcuts: ShortcutSettings = { ...DEFAULT_SHORTCUTS };
let isRecording = false;


async function ensureRecordingsDir() {
  try {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true })
    console.log('RECORDINGS_DIR:', RECORDINGS_DIR)
    console.log('User Data Path:', app.getPath('userData'))
  } catch (error) {
    console.error('Failed to create recordings directory:', error)
  }
}

// 加载快捷键设置
async function loadShortcutSettings(): Promise<ShortcutSettings> {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'shortcut-settings.json');
    const data = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(data);
    return { ...DEFAULT_SHORTCUTS, ...settings };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}

// 保存快捷键设置
async function saveShortcutSettings(settings: ShortcutSettings): Promise<void> {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'shortcut-settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Failed to save shortcut settings:', error);
  }
}

// 注册全局快捷键
function registerGlobalShortcuts() {
  // 先注销所有快捷键
  globalShortcut.unregisterAll();
  
  // 注册停止录制快捷键
  if (currentShortcuts.stopRecording) {
    try {
      globalShortcut.register(currentShortcuts.stopRecording, () => {
        if (isRecording && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('global-shortcut', 'stop');
          mainWindow.webContents.send('stop-recording-from-tray');
        }
      });
      console.log(`Registered stop shortcut: ${currentShortcuts.stopRecording}`);
    } catch (error) {
      console.error('Failed to register stop shortcut:', error);
    }
  }
  
  // 注册暂停录制快捷键
  if (currentShortcuts.pauseRecording) {
    try {
      globalShortcut.register(currentShortcuts.pauseRecording, () => {
        if (isRecording && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('global-shortcut', 'pause');
          mainWindow.webContents.send('pause-recording-from-tray');
        }
      });
      console.log(`Registered pause shortcut: ${currentShortcuts.pauseRecording}`);
    } catch (error) {
      console.error('Failed to register pause shortcut:', error);
    }
  }
}

// 创建中文菜单栏
function createApplicationMenu() {
  const isMac = process.platform === 'darwin'
  
  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS 应用菜单
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const, label: '关于 OpenScreen' },
        { type: 'separator' as const },
        { role: 'services' as const, label: '服务' },
        { type: 'separator' as const },
        { role: 'hide' as const, label: '隐藏 OpenScreen' },
        { role: 'hideOthers' as const, label: '隐藏其他' },
        { role: 'unhide' as const, label: '显示全部' },
        { type: 'separator' as const },
        { role: 'quit' as const, label: '退出 OpenScreen' }
      ]
    }] : []),
    // 文件菜单
    {
      label: '文件',
      submenu: [
        isMac ? { role: 'close' as const, label: '关闭' } : { role: 'quit' as const, label: '退出' }
      ]
    },
    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        { role: 'undo' as const, label: '撤销' },
        { role: 'redo' as const, label: '重做' },
        { type: 'separator' as const },
        { role: 'cut' as const, label: '剪切' },
        { role: 'copy' as const, label: '复制' },
        { role: 'paste' as const, label: '粘贴' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const, label: '粘贴并匹配样式' },
          { role: 'delete' as const, label: '删除' },
          { role: 'selectAll' as const, label: '全选' }
        ] : [
          { role: 'delete' as const, label: '删除' },
          { type: 'separator' as const },
          { role: 'selectAll' as const, label: '全选' }
        ])
      ]
    },
    // 视图菜单
    {
      label: '视图',
      submenu: [
        { role: 'reload' as const, label: '重新加载' },
        { role: 'forceReload' as const, label: '强制重新加载' },
        { role: 'toggleDevTools' as const, label: '开发者工具' },
        { type: 'separator' as const },
        { role: 'resetZoom' as const, label: '重置缩放' },
        { role: 'zoomIn' as const, label: '放大' },
        { role: 'zoomOut' as const, label: '缩小' },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const, label: '全屏' }
      ]
    },
    // 窗口菜单
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' as const, label: '最小化' },
        { role: 'zoom' as const, label: '缩放' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const, label: '前置全部窗口' }
        ] : [
          { role: 'close' as const, label: '关闭' }
        ])
      ]
    },
    // 帮助菜单
    {
      label: '帮助',
      role: 'help' as const,
      submenu: [
        {
          label: '了解更多',
          click: async () => {
            const { shell } = await import('electron')
            await shell.openExternal('https://github.com/siddharthvaddem/openscreen')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Window references
let mainWindow: BrowserWindow | null = null
let sourceSelectorWindow: BrowserWindow | null = null
let tray: Tray | null = null
let selectedSourceName = ''

// Tray Icons
const defaultTrayIcon = getTrayIcon('openscreen.png');
const recordingTrayIcon = getTrayIcon('rec-button.png');

function createWindow() {
  mainWindow = createHudOverlayWindow()
}

function createTray() {
  tray = new Tray(defaultTrayIcon);
}

function getTrayIcon(filename: string) {
  return nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC || RENDERER_DIST, filename)).resize({
    width: 24,
    height: 24,
    quality: 'best'
  });
}


function updateTrayMenu(recording: boolean = false) {
  if (!tray) return;
  const trayIcon = recording ? recordingTrayIcon : defaultTrayIcon;
  const trayToolTip = recording ? `正在录制: ${selectedSourceName}` : "OpenScreen";
  const menuTemplate = recording
    ? [
        {
          label: "停止录制",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("stop-recording-from-tray");
            }
          },
        },
      ]
    : [
        {
          label: "打开",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.isMinimized() && mainWindow.restore();
            } else {
              createWindow();
            }
          },
        },
        {
          label: "退出",
          click: () => {
            app.quit();
          },
        },
      ];
  tray.setImage(trayIcon);
  tray.setToolTip(trayToolTip);
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}

function createEditorWindowWrapper() {
  if (mainWindow) {
    mainWindow.close()
    mainWindow = null
  }
  mainWindow = createEditorWindow()
}

function createSourceSelectorWindowWrapper() {
  sourceSelectorWindow = createSourceSelectorWindow()
  sourceSelectorWindow.on('closed', () => {
    sourceSelectorWindow = null
  })
  return sourceSelectorWindow
}

// On macOS, applications and their menu bar stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Keep app running (macOS behavior)
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})



// Register all IPC handlers when app is ready
app.whenReady().then(async () => {
    // 创建中文菜单栏
    createApplicationMenu()
    
    // 加载快捷键设置
    currentShortcuts = await loadShortcutSettings();
    
    // Listen for HUD overlay quit event (macOS only)
    const { ipcMain, session } = await import('electron');
    ipcMain.on('hud-overlay-close', () => {
      app.quit();
    });
    
    // 快捷键设置 IPC
    ipcMain.handle('get-shortcut-settings', () => {
      return currentShortcuts;
    });
    
    ipcMain.handle('set-shortcut-settings', async (_, settings: ShortcutSettings) => {
      currentShortcuts = { ...DEFAULT_SHORTCUTS, ...settings };
      await saveShortcutSettings(currentShortcuts);
      registerGlobalShortcuts();
      return { success: true };
    });
    
    // 设置权限处理器，自动授予音频和视频权限
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowedPermissions = ['media', 'mediaKeySystem', 'audioCapture', 'display-capture'];
      if (allowedPermissions.includes(permission)) {
        console.log(`Permission granted: ${permission}`);
        callback(true);
      } else {
        console.log(`Permission denied: ${permission}`);
        callback(false);
      }
    });
    
    // 设置权限检查处理器
    session.defaultSession.setPermissionCheckHandler((_webContents, permission, _requestingOrigin, _details) => {
      const allowedPermissions = ['media', 'mediaKeySystem', 'audioCapture', 'display-capture'];
      if (allowedPermissions.includes(permission)) {
        return true;
      }
      return false;
    });
    
    createTray()
    updateTrayMenu()
  // Ensure recordings directory exists
  await ensureRecordingsDir()
  
  // 注册全局快捷键
  registerGlobalShortcuts();

  registerIpcHandlers(
    createEditorWindowWrapper,
    createSourceSelectorWindowWrapper,
    () => mainWindow,
    () => sourceSelectorWindow,
    (recording: boolean, sourceName: string) => {
      selectedSourceName = sourceName
      isRecording = recording  // 更新录制状态
      if (!tray) createTray();
      updateTrayMenu(recording);
      if (!recording) {
        // 录制停止，恢复主窗口
        if (mainWindow) mainWindow.show();
      }
    }
  )
  createWindow()
})

// 应用退出时注销快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
})
