import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { app } from "electron";

export type DisplayMode = "simple" | "complex";

export type OverlaySettings = {
  apiBaseUrl: string;
  pollMs: number;
  displayMode: DisplayMode;
};

const defaults: OverlaySettings = {
  apiBaseUrl: "http://localhost:3000",
  pollMs: 0,
  displayMode: "complex",
};

function configPath(): string {
  const dir = app.getPath("userData");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "toliveby-overlay.json");
}

export function loadSettings(): OverlaySettings {
  const p = configPath();
  try {
    if (!existsSync(p)) {
      return { ...defaults };
    }
    const raw = readFileSync(p, "utf8");
    const data = JSON.parse(raw) as Partial<OverlaySettings>;
    const mode =
      data.displayMode === "simple" || data.displayMode === "complex"
        ? data.displayMode
        : defaults.displayMode;
    return {
      apiBaseUrl: typeof data.apiBaseUrl === "string" ? data.apiBaseUrl : defaults.apiBaseUrl,
      pollMs: typeof data.pollMs === "number" && data.pollMs >= 0 ? data.pollMs : defaults.pollMs,
      displayMode: mode,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(patch: Partial<OverlaySettings>): OverlaySettings {
  const next = { ...loadSettings(), ...patch };
  writeFileSync(configPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}
