import { contextBridge, ipcRenderer } from "electron";

/** Inline shape — undgår runtime-import fra api-client i preload-bundlen */
type QuotePayload = {
  id: string;
  body: string;
  author: string | null;
  category: string;
  tags: string[];
  createdAt: string;
};

type SettingsPayload = {
  apiBaseUrl: string;
  pollMs: number;
  displayMode: "simple" | "complex";
};

type Bridge = {
  getSettings: () => Promise<SettingsPayload>;
  saveSettings: (patch: Partial<SettingsPayload>) => Promise<SettingsPayload>;
  fetchQuote: (category?: string) => Promise<QuotePayload>;
  openExternal: (url: string) => Promise<void>;
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  setWindowLayout: (mode: "simple" | "complex") => Promise<void>;
};

const bridge: Bridge = {
  getSettings: () => ipcRenderer.invoke("toliveby:getSettings"),
  saveSettings: (patch) => ipcRenderer.invoke("toliveby:saveSettings", patch),
  fetchQuote: (category) => ipcRenderer.invoke("toliveby:fetchQuote", category),
  openExternal: (url) => ipcRenderer.invoke("toliveby:openExternal", url),
  minimize: () => ipcRenderer.invoke("toliveby:minimize"),
  close: () => ipcRenderer.invoke("toliveby:close"),
  setWindowLayout: (mode) => ipcRenderer.invoke("toliveby:setWindowLayout", mode),
};

contextBridge.exposeInMainWorld("toliveby", bridge);
