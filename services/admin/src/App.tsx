import { useCallback, useEffect, useMemo, useState } from "react";

type Category = "general" | "stoicism" | "motivation" | "discipline";

type Quote = {
  id: string;
  body: string;
  author: string | null;
  category: Category;
  tags: string[];
  createdAt: string;
  isActive: boolean;
};

const ADMIN_KEY_STORAGE = "toliveby_admin_key";

async function api<T>(
  path: string,
  init: RequestInit & { admin?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.admin) {
    const key = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (key) {
      headers.set("X-Admin-Key", key);
    }
  }

  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && data && "error" in data
        ? String((data as { error?: string }).error)
        : res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }

  return data as T;
}

export function App() {
  const [adminKey, setAdminKey] = useState(() =>
    localStorage.getItem(ADMIN_KEY_STORAGE),
  );
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [categoryFilter, setCategoryFilter] = useState<Category | "">("");
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [newBody, setNewBody] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("general");
  const [newTags, setNewTags] = useState("");

  const persistKey = () => {
    if (adminKey) {
      localStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
    } else {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      persistKey();
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (categoryFilter) {
        params.set("category", categoryFilter);
      }
      if (showInactive) {
        params.set("includeInactive", "true");
      }

      const data = await api<{
        quotes: Quote[];
        total: number;
        page: number;
      }>(`/v1/quotes?${params.toString()}`, { admin: showInactive });

      setQuotes(data.quotes);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [page, limit, categoryFilter, showInactive, adminKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit],
  );

  const createQuote = async () => {
    setError(null);
    try {
      persistKey();
      const tags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await api(`/v1/quotes`, {
        method: "POST",
        admin: true,
        body: JSON.stringify({
          body: newBody,
          author: newAuthor.trim() ? newAuthor.trim() : null,
          category: newCategory,
          tags,
          isActive: true,
        }),
      });

      setNewBody("");
      setNewAuthor("");
      setNewTags("");
      setPage(1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const deactivate = async (id: string) => {
    setError(null);
    try {
      persistKey();
      await api(`/v1/quotes/${id}`, { method: "DELETE", admin: true });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const hardDelete = async (id: string) => {
    if (!confirm("Slette permanent?")) return;
    setError(null);
    try {
      persistKey();
      await api(`/v1/quotes/${id}?hard=true`, {
        method: "DELETE",
        admin: true,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="page">
      <h1 className="h1">ToLiveBy Admin</h1>
      <p className="muted">
        Admin bruger <code>X-Admin-Key</code> som matcher{" "}
        <code>ADMIN_API_KEY</code> i API-containeren.
      </p>

      <div className="panel">
        <h2 className="h2">Nøgle</h2>
        <div className="row">
          <label>
            X-Admin-Key
            <input
              type="password"
              value={adminKey ?? ""}
              onChange={(e) => setAdminKey(e.target.value)}
              autoComplete="off"
              placeholder="Indsæt admin-nøgle"
            />
          </label>
          <button type="button" className="secondary" onClick={load}>
            Opdater liste
          </button>
        </div>
      </div>

      <div className="panel">
        <h2 className="h2">Nyt citat</h2>
        <div className="row">
          <label>
            Tekst
            <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} />
          </label>
        </div>
        <div className="row" style={{ marginTop: "0.65rem" }}>
          <label>
            Forfatter (valgfri)
            <input value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} />
          </label>
          <label>
            Kategori
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as Category)}
            >
              <option value="general">general</option>
              <option value="stoicism">stoicism</option>
              <option value="motivation">motivation</option>
              <option value="discipline">discipline</option>
            </select>
          </label>
          <label>
            Tags (komma)
            <input
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="mod, vaner"
            />
          </label>
          <button type="button" onClick={createQuote}>
            Opret
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="row">
          <label>
            Filter kategori
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as Category | "")}
            >
              <option value="">Alle</option>
              <option value="general">general</option>
              <option value="stoicism">stoicism</option>
              <option value="motivation">motivation</option>
              <option value="discipline">discipline</option>
            </select>
          </label>
          <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => {
                setShowInactive(e.target.checked);
                setPage(1);
              }}
            />
            Vis inaktive (kræver nøgle)
          </label>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {loading ? <p className="muted">Indlæser…</p> : null}

        <table>
          <thead>
            <tr>
              <th>Tekst</th>
              <th>Kategori</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className={q.isActive ? "" : "inactive"}>
                <td>
                  <div>{q.body}</div>
                  <div className="muted" style={{ marginTop: "0.35rem" }}>
                    {q.author ? `${q.author} · ` : null}
                    {new Date(q.createdAt).toLocaleString("da-DK")}
                  </div>
                  {q.tags?.length ? (
                    <div style={{ marginTop: "0.35rem" }}>
                      {q.tags.map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td>{q.category}</td>
                <td>
                  <div className="actions">
                    {q.isActive ? (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => deactivate(q.id)}
                      >
                        Deaktiver
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="danger"
                      onClick={() => hardDelete(q.id)}
                    >
                      Slet
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Forrige
          </button>
          <span className="muted">
            Side {page} af {pages} ({total} i alt)
          </span>
          <button
            type="button"
            className="secondary"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Næste
          </button>
        </div>
      </div>
    </div>
  );
}
