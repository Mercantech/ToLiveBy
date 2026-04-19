"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function joinUrl(base, path) {
    const b = base.replace(/\/+$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${b}${p}`;
}
async function fetchRandomQuote(baseUrl, options = {}) {
    const u = new URL(joinUrl(baseUrl, "/v1/quotes/random"));
    if (options.category) {
        u.searchParams.set("category", options.category);
    }
    const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
    }
    if (!data?.quote) {
        throw new Error("Unexpected response");
    }
    return data.quote;
}
function getBaseUrl() {
    const cfg = vscode.workspace.getConfiguration("toliveby");
    const raw = cfg.get("apiBaseUrl") ?? "http://localhost:3000";
    return raw.replace(/\/+$/, "");
}
async function showQuote(category) {
    try {
        const quote = await fetchRandomQuote(getBaseUrl(), { category });
        const meta = [
            quote.category,
            quote.author ? quote.author : null,
            new Date(quote.createdAt).toLocaleString("da-DK"),
        ]
            .filter(Boolean)
            .join(" · ");
        const msg = `${quote.body}\n\n— ${meta}`;
        await vscode.window.showInformationMessage(msg);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await vscode.window.showErrorMessage(`ToLiveBy: Kunne ikke hente citat (${msg})`);
    }
}
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand("toliveby.randomQuote", async () => {
        await showQuote(undefined);
    }), vscode.commands.registerCommand("toliveby.randomQuoteCategory", async () => {
        const pick = await vscode.window.showQuickPick([
            { label: "general", value: "general" },
            { label: "stoicism", value: "stoicism" },
            { label: "motivation", value: "motivation" },
            { label: "discipline", value: "discipline" },
        ], { title: "Vælg kategori", placeHolder: "ToLiveBy kategori" });
        if (!pick)
            return;
        await showQuote(pick.value);
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map