import * as vscode from "vscode";

type QuoteCategory = "general" | "stoicism" | "motivation" | "discipline";

type Quote = {
  id: string;
  body: string;
  author: string | null;
  category: QuoteCategory;
  tags: string[];
  createdAt: string;
};

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function fetchRandomQuote(
  baseUrl: string,
  options: { category?: QuoteCategory } = {},
): Promise<Quote> {
  const u = new URL(joinUrl(baseUrl, "/v1/quotes/random"));
  if (options.category) {
    u.searchParams.set("category", options.category);
  }

  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as { quote?: Quote; error?: string }) : null;

  if (!res.ok) {
    throw new Error(data?.error ?? `HTTP ${res.status}`);
  }

  if (!data?.quote) {
    throw new Error("Unexpected response");
  }

  return data.quote;
}

function getBaseUrl(): string {
  const cfg = vscode.workspace.getConfiguration("toliveby");
  const raw = cfg.get<string>("apiBaseUrl") ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

async function showQuote(category?: QuoteCategory) {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await vscode.window.showErrorMessage(`ToLiveBy: Kunne ikke hente citat (${msg})`);
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("toliveby.randomQuote", async () => {
      await showQuote(undefined);
    }),
    vscode.commands.registerCommand("toliveby.randomQuoteCategory", async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: "general", value: "general" as const },
          { label: "stoicism", value: "stoicism" as const },
          { label: "motivation", value: "motivation" as const },
          { label: "discipline", value: "discipline" as const },
        ],
        { title: "Vælg kategori", placeHolder: "ToLiveBy kategori" },
      );

      if (!pick) return;
      await showQuote(pick.value);
    }),
  );
}

export function deactivate() {}
