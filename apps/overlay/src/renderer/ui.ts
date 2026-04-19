type DisplayMode = "simple" | "complex";

type Quote = {
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
  displayMode: DisplayMode;
};

type Bridge = {
  getSettings: () => Promise<SettingsPayload>;
  saveSettings: (patch: Partial<SettingsPayload>) => Promise<SettingsPayload>;
  fetchQuote: (category?: string) => Promise<Quote>;
  openExternal: (url: string) => Promise<void>;
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  setWindowLayout: (mode: DisplayMode) => Promise<void>;
};

declare global {
  interface Window {
    toliveby: Bridge;
  }
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

let currentMode: DisplayMode = "complex";

function normalizeMode(mode: unknown): DisplayMode {
  return mode === "simple" || mode === "complex" ? mode : "complex";
}

function applyDisplayMode(mode: DisplayMode) {
  const m = normalizeMode(mode);
  currentMode = m;
  document.body.dataset.displayMode = m;

  const complex = el<HTMLDivElement>("shellComplex");
  const simple = el<HTMLDivElement>("shellSimple");

  const showSimple = m === "simple";
  complex.toggleAttribute("hidden", showSimple);
  simple.toggleAttribute("hidden", !showSimple);
  complex.classList.toggle("is-view-hidden", showSimple);
  simple.classList.toggle("is-view-hidden", !showSimple);

  void window.toliveby?.setWindowLayout(m);
}

/** Citattekst + valgfri forfatter (grå linje under) + ekstra meta kun i kompleks boble */
function paintQuoteUi(body: string, author: string | null, complexMeta: string) {
  el<HTMLDivElement>("quoteText").textContent = body;
  el<HTMLDivElement>("simpleQuote").textContent = body;
  el<HTMLDivElement>("quoteMeta").textContent = complexMeta;

  const trimmed = author?.trim() ?? "";
  const hasAuthor = trimmed.length > 0;
  const authorLine = hasAuthor ? `Forfatter: ${trimmed}` : "";

  const qa = el<HTMLDivElement>("quoteAuthor");
  const sa = el<HTMLDivElement>("simpleAuthor");
  qa.textContent = authorLine;
  sa.textContent = authorLine;
  qa.toggleAttribute("hidden", !hasAuthor);
  sa.toggleAttribute("hidden", !hasAuthor);
}

let pollTimer: number | undefined;

function schedulePoll(ms: number) {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = undefined;
  }
  if (ms <= 0) return;
  pollTimer = window.setInterval(() => {
    void refresh();
  }, ms);
}

async function refresh() {
  if (!window.toliveby?.fetchQuote) {
    const msg = "Electron preload ikke indlæst — kør npm run build";
    paintQuoteUi(msg, null, "");
    return;
  }
  try {
    paintQuoteUi("Henter…", null, "");
    const quote = await window.toliveby.fetchQuote();
    renderQuote(quote);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (currentMode === "simple") {
      paintQuoteUi("Kunne ikke hente citat", null, msg);
    } else {
      paintQuoteUi("Kunne ikke hente fra API.", null, msg);
    }
  }
}

async function surprise() {
  if (!window.toliveby?.fetchQuote) return;
  const categories = ["stoicism", "motivation", "discipline", "general"] as const;
  const pick = categories[Math.floor(Math.random() * categories.length)];
  try {
    paintQuoteUi("Henter…", null, "");
    const quote = await window.toliveby.fetchQuote(pick);
    renderQuote(quote);
  } catch (e) {
    paintQuoteUi(
      "Kunne ikke hente fra API.",
      null,
      e instanceof Error ? e.message : String(e),
    );
  }
}

function renderQuote(q: Quote) {
  if (currentMode === "simple") {
    paintQuoteUi(q.body, q.author, "");
    return;
  }

  const metaBits: string[] = [];
  metaBits.push(`Kategori: ${q.category}`);
  metaBits.push(new Date(q.createdAt).toLocaleString("da-DK"));
  paintQuoteUi(q.body, q.author, metaBits.join(" · "));
}

async function persistMode(mode: DisplayMode) {
  const m = normalizeMode(mode);
  applyDisplayMode(m);
  try {
    await window.toliveby.saveSettings({ displayMode: m });
  } catch {
    /* UI er allerede opdateret */
  }
}

function otherMode(mode: DisplayMode): DisplayMode {
  return mode === "simple" ? "complex" : "simple";
}

document.getElementById("btnToggleMode")?.addEventListener("click", async () => {
  if (!window.toliveby) return;
  await persistMode(otherMode(currentMode));
});

document.getElementById("btnRefresh")?.addEventListener("click", () => void refresh());
document.getElementById("btnRandom")?.addEventListener("click", () => void surprise());
document.getElementById("btnSimpleRefresh")?.addEventListener("click", () => void refresh());

document.getElementById("btnSettings")?.addEventListener("click", async () => {
  if (!window.toliveby?.getSettings) return;
  const dlg = el<HTMLDialogElement>("dlg");
  const s = await window.toliveby.getSettings();
  el<HTMLInputElement>("apiUrl").value = s.apiBaseUrl;
  el<HTMLInputElement>("pollSec").value = String(Math.round(s.pollMs / 1000));
  el<HTMLSelectElement>("displayMode").value = s.displayMode;
  dlg.showModal();
});

document.getElementById("dlgSave")?.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!window.toliveby?.saveSettings) return;
  const dlg = el<HTMLDialogElement>("dlg");
  const apiBaseUrl = el<HTMLInputElement>("apiUrl").value.trim();
  const sec = Number(el<HTMLInputElement>("pollSec").value);
  const pollMs = Number.isFinite(sec) && sec > 0 ? Math.floor(sec * 1000) : 0;
  const displayMode = normalizeMode(el<HTMLSelectElement>("displayMode").value);

  await window.toliveby.saveSettings({ apiBaseUrl, pollMs, displayMode });
  applyDisplayMode(displayMode);
  schedulePoll(pollMs);
  dlg.close();
  await refresh();
});

document.getElementById("btnMinimize")?.addEventListener("click", () => {
  void window.toliveby.minimize();
});

document.getElementById("btnClose")?.addEventListener("click", () => {
  void window.toliveby.close();
});

async function boot() {
  if (!window.toliveby) {
    const msg =
      "Forbindelsen til Electron (preload) fejlede. Genbyg med: npm run build && npm run copy:html";
    paintQuoteUi(msg, null, "");
    return;
  }

  const s = await window.toliveby.getSettings();
  el<HTMLInputElement>("apiUrl").value = s.apiBaseUrl;
  el<HTMLInputElement>("pollSec").value = String(Math.round(s.pollMs / 1000));
  el<HTMLSelectElement>("displayMode").value = normalizeMode(s.displayMode);

  applyDisplayMode(normalizeMode(s.displayMode));
  schedulePoll(s.pollMs);
  await refresh();
}

void boot();
