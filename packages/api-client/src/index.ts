export type QuoteCategory = "general" | "stoicism" | "motivation" | "discipline";

export type Quote = {
  id: string;
  body: string;
  author: string | null;
  category: QuoteCategory;
  tags: string[];
  createdAt: string;
};

export type RandomQuoteResponse = { quote: Quote };

export type ListQuotesResponse = {
  quotes: Array<Quote & { isActive: boolean }>;
  page: number;
  limit: number;
  total: number;
};

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export async function fetchRandomQuote(
  baseUrl: string,
  options: { category?: QuoteCategory; signal?: AbortSignal } = {},
): Promise<Quote> {
  const u = new URL(joinUrl(baseUrl, "/v1/quotes/random"));
  if (options.category) {
    u.searchParams.set("category", options.category);
  }

  const res = await fetch(u.toString(), {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as RandomQuoteResponse | { error?: string }) : null;

  if (!res.ok) {
    throw new Error(
      data && typeof data === "object" && data && "error" in data
        ? String(data.error)
        : `HTTP ${res.status}`,
    );
  }

  if (!data || !("quote" in data)) {
    throw new Error("Unexpected response");
  }

  return data.quote;
}
