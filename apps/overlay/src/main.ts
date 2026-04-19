import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRandomQuote } from "@toliveby/api-client";
import { BrowserWindow, app, ipcMain, shell } from "electron";
import {
  loadSettings,
  saveSettings,
  type DisplayMode,
  type OverlaySettings,
} from "./settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function windowSizeForMode(mode: DisplayMode) {
  if (mode === "simple") {
    return { width: 300, height: 120, minWidth: 260, minHeight: 96 };
  }
  return { width: 420, height: 360, minWidth: 360, minHeight: 300 };
}

function applyLayoutToWindow(mode: DisplayMode) {
  const w = mainWindow;
  if (!w) return;
  const { width, height, minWidth, minHeight } = windowSizeForMode(mode);
  w.setMinimumSize(minWidth, minHeight);
  w.setSize(width, height, true);
}

function createWindow() {
  const mode = loadSettings().displayMode;
  const initial = windowSizeForMode(mode);

  const win = new BrowserWindow({
    width: initial.width,
    height: initial.height,
    minWidth: initial.minWidth,
    minHeight: initial.minHeight,
    show: true,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    maximizable: false,
    minimizable: true,
    title: "ToLiveBy Ven",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
    },
  });

  win.setAlwaysOnTop(true, "floating");

  const htmlPath = path.join(__dirname, "renderer", "index.html");
  void win.loadFile(htmlPath);

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow = win;

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("toliveby:getSettings", (): OverlaySettings => loadSettings());

ipcMain.handle(
  "toliveby:saveSettings",
  (_evt, patch: Partial<OverlaySettings>): OverlaySettings => saveSettings(patch),
);

ipcMain.handle(
  "toliveby:fetchQuote",
  async (_evt, category?: string) => {
    const cfg = loadSettings();
    const quote = await fetchRandomQuote(cfg.apiBaseUrl, {
      category: category as import("@toliveby/api-client").QuoteCategory | undefined,
    });
    return quote;
  },
);

ipcMain.handle("toliveby:openExternal", (_evt, url: string) => {
  void shell.openExternal(url);
});

ipcMain.handle("toliveby:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("toliveby:close", () => {
  mainWindow?.close();
});

ipcMain.handle("toliveby:setWindowLayout", (_evt, mode: DisplayMode) => {
  applyLayoutToWindow(mode);
});
