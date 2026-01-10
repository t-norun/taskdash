// apps/web/src/lib/api.ts
export const apiBase =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${apiBase}${path.startsWith("/") ? "" : "/"}${path}`;

  const r = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  // ここで落とすと原因が追いやすい
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} ${r.statusText} :: ${text}`);
  }

  // JSON前提
  return (await r.json()) as T;
}
