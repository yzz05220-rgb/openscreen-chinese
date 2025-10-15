import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createHudOverlayWindow, createEditorWindow, createSourceSelectorWindow } from './windows'
import { registerIpcHandlers } from './ipc/handlers'
import { cleanupMouseTracking } from './ipc/mouseTracking'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const RECORDINGS_DIR = path.join(app.getPath('userData'), 'recordings')

// Cleanup old recordings (older than 1 day)
async function cleanupOldRecordings() {
  try {
    const files = await fs.readdir(RECORDINGS_DIR)
    const now = Date.now()
    const maxAge = 1 * 24 * 60 * 60 * 1000
    
    for (const file of files) {
      const filePath = path.join(RECORDINGS_DIR, file)
      const stats = await fs.stat(filePath)
      
      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath)
        console.log(`Deleted old recording: ${file}`)
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old recordings:', error)
  }
}

async function ensureRecordingsDir() {
  try {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true })
    console.log('Recordings directory ready:', RECORDINGS_DIR)
  } catch (error) {
    console.error('Failed to create recordings directory:', error)
  }
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

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Window references
let mainWindow: BrowserWindow | null = null
let sourceSelectorWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = createHudOverlayWindow()
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

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanupMouseTracking()
    app.quit()
    mainWindow = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Cleanup old recordings on quit (both macOS and other platforms)
app.on('before-quit', async (event) => {
  event.preventDefault()
  cleanupMouseTracking()
  await cleanupOldRecordings()
  app.exit(0)
})

// Register all IPC handlers when app is ready
app.whenReady().then(async () => {
  // Ensure recordings directory exists
  await ensureRecordingsDir()
  
  registerIpcHandlers(
    createEditorWindowWrapper,
    createSourceSelectorWindowWrapper,
    () => mainWindow,
    () => sourceSelectorWindow
  )
  createWindow()
})
