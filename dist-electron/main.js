import { ipcMain as i, screen as b, BrowserWindow as R, desktopCapturer as V, shell as O, app as d, dialog as S, nativeImage as W, Tray as k, Menu as L } from "electron";
import { fileURLToPath as E } from "node:url";
import o from "node:path";
import P from "node:fs/promises";
const _ = o.dirname(E(import.meta.url)), U = o.join(_, ".."), m = process.env.VITE_DEV_SERVER_URL, T = o.join(U, "dist");
let f = null;
i.on("hud-overlay-hide", () => {
  f && !f.isDestroyed() && f.minimize();
});
function C() {
  const r = b.getPrimaryDisplay(), { workArea: n } = r, c = 500, w = 100, y = Math.floor(n.x + (n.width - c) / 2), h = Math.floor(n.y + n.height - w - 5), e = new R({
    width: c,
    height: w,
    minWidth: 500,
    maxWidth: 500,
    minHeight: 100,
    maxHeight: 100,
    x: y,
    y: h,
    frame: !1,
    transparent: !0,
    resizable: !1,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    hasShadow: !1,
    webPreferences: {
      preload: o.join(_, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      backgroundThrottling: !1
    }
  });
  return e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), f = e, e.on("closed", () => {
    f === e && (f = null);
  }), m ? e.loadURL(m + "?windowType=hud-overlay") : e.loadFile(o.join(T, "index.html"), {
    query: { windowType: "hud-overlay" }
  }), e;
}
function M() {
  const r = new R({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    transparent: !1,
    resizable: !0,
    alwaysOnTop: !1,
    skipTaskbar: !1,
    title: "OpenScreen",
    backgroundColor: "#000000",
    webPreferences: {
      preload: o.join(_, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      webSecurity: !1,
      backgroundThrottling: !1
    }
  });
  return r.maximize(), r.webContents.on("did-finish-load", () => {
    r == null || r.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), m ? r.loadURL(m + "?windowType=editor") : r.loadFile(o.join(T, "index.html"), {
    query: { windowType: "editor" }
  }), r;
}
function A() {
  const { width: r, height: n } = b.getPrimaryDisplay().workAreaSize, c = new R({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((r - 620) / 2),
    y: Math.round((n - 420) / 2),
    frame: !1,
    resizable: !1,
    alwaysOnTop: !0,
    transparent: !0,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: o.join(_, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  return m ? c.loadURL(m + "?windowType=source-selector") : c.loadFile(o.join(T, "index.html"), {
    query: { windowType: "source-selector" }
  }), c;
}
let v = null;
function H(r, n, c, w, y) {
  i.handle("get-sources", async (e, s) => (await V.getSources(s)).map((t) => ({
    id: t.id,
    name: t.name,
    display_id: t.display_id,
    thumbnail: t.thumbnail ? t.thumbnail.toDataURL() : null,
    appIcon: t.appIcon ? t.appIcon.toDataURL() : null
  }))), i.handle("select-source", (e, s) => {
    v = s;
    const a = w();
    return a && a.close(), v;
  }), i.handle("get-selected-source", () => v), i.handle("open-source-selector", () => {
    const e = w();
    if (e) {
      e.focus();
      return;
    }
    n();
  }), i.handle("switch-to-editor", () => {
    const e = c();
    e && e.close(), r();
  }), i.handle("store-recorded-video", async (e, s, a) => {
    try {
      const t = o.join(p, a);
      return await P.writeFile(t, Buffer.from(s)), h = t, {
        success: !0,
        path: t,
        message: "Video stored successfully"
      };
    } catch (t) {
      return console.error("Failed to store video:", t), {
        success: !1,
        message: "Failed to store video",
        error: String(t)
      };
    }
  }), i.handle("get-recorded-video-path", async () => {
    try {
      const s = (await P.readdir(p)).filter((j) => j.endsWith(".webm"));
      if (s.length === 0)
        return { success: !1, message: "No recorded video found" };
      const a = s.sort().reverse()[0];
      return { success: !0, path: o.join(p, a) };
    } catch (e) {
      return console.error("Failed to get video path:", e), { success: !1, message: "Failed to get video path", error: String(e) };
    }
  }), i.handle("set-recording-state", (e, s) => {
    y && y(s, (v || { name: "Screen" }).name);
  }), i.handle("open-external-url", async (e, s) => {
    try {
      return await O.openExternal(s), { success: !0 };
    } catch (a) {
      return console.error("Failed to open URL:", a), { success: !1, error: String(a) };
    }
  }), i.handle("get-asset-base-path", () => {
    try {
      return d.isPackaged ? o.join(process.resourcesPath, "assets") : o.join(d.getAppPath(), "public", "assets");
    } catch (e) {
      return console.error("Failed to resolve asset base path:", e), null;
    }
  }), i.handle("save-exported-video", async (e, s, a) => {
    try {
      const t = await S.showSaveDialog({
        title: "Save Exported Video",
        defaultPath: o.join(d.getPath("downloads"), a),
        filters: [
          { name: "MP4 Video", extensions: ["mp4"] }
        ],
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });
      return t.canceled || !t.filePath ? {
        success: !1,
        cancelled: !0,
        message: "Export cancelled"
      } : (await P.writeFile(t.filePath, Buffer.from(s)), {
        success: !0,
        path: t.filePath,
        message: "Video exported successfully"
      });
    } catch (t) {
      return console.error("Failed to save exported video:", t), {
        success: !1,
        message: "Failed to save exported video",
        error: String(t)
      };
    }
  }), i.handle("open-video-file-picker", async () => {
    try {
      const e = await S.showOpenDialog({
        title: "Select Video File",
        defaultPath: p,
        filters: [
          { name: "Video Files", extensions: ["webm", "mp4", "mov", "avi", "mkv"] },
          { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"]
      });
      return e.canceled || e.filePaths.length === 0 ? { success: !1, cancelled: !0 } : {
        success: !0,
        path: e.filePaths[0]
      };
    } catch (e) {
      return console.error("Failed to open file picker:", e), {
        success: !1,
        message: "Failed to open file picker",
        error: String(e)
      };
    }
  });
  let h = null;
  i.handle("set-current-video-path", (e, s) => (h = s, { success: !0 })), i.handle("get-current-video-path", () => h ? { success: !0, path: h } : { success: !1 }), i.handle("clear-current-video-path", () => (h = null, { success: !0 }));
}
const z = o.dirname(E(import.meta.url)), p = o.join(d.getPath("userData"), "recordings");
async function N() {
  try {
    await P.mkdir(p, { recursive: !0 }), console.log("RECORDINGS_DIR:", p), console.log("User Data Path:", d.getPath("userData"));
  } catch (r) {
    console.error("Failed to create recordings directory:", r);
  }
}
process.env.APP_ROOT = o.join(z, "..");
const B = process.env.VITE_DEV_SERVER_URL, Y = o.join(process.env.APP_ROOT, "dist-electron"), D = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = B ? o.join(process.env.APP_ROOT, "public") : D;
let l = null, g = null, u = null, x = "";
function I() {
  l = C();
}
function q() {
  const r = o.join(process.env.VITE_PUBLIC || D, "rec-button.png");
  let n = W.createFromPath(r);
  n = n.resize({ width: 24, height: 24, quality: "best" }), u = new k(n), F();
}
function F() {
  if (!u) return;
  const r = [
    {
      label: "Stop Recording",
      click: () => {
        l && !l.isDestroyed() && l.webContents.send("stop-recording-from-tray");
      }
    }
  ], n = L.buildFromTemplate(r);
  u.setContextMenu(n), u.setToolTip(`Recording: ${x}`);
}
function $() {
  l && (l.close(), l = null), l = M();
}
function G() {
  return g = A(), g.on("closed", () => {
    g = null;
  }), g;
}
d.on("window-all-closed", () => {
});
d.on("activate", () => {
  R.getAllWindows().length === 0 && I();
});
d.whenReady().then(async () => {
  const { ipcMain: r } = await import("electron");
  r.on("hud-overlay-close", () => {
    process.platform === "darwin" && d.quit();
  }), await N(), H(
    $,
    G,
    () => l,
    () => g,
    (n, c) => {
      x = c, n ? (u || q(), F()) : (u && (u.destroy(), u = null), l && l.restore());
    }
  ), I();
});
export {
  Y as MAIN_DIST,
  p as RECORDINGS_DIR,
  D as RENDERER_DIST,
  B as VITE_DEV_SERVER_URL
};
