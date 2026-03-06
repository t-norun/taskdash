// apps/web/src/utils/navigation.js

export function getQueryParam(key) {
  try {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get(key);

    // null / 空 / "undefined" / "null" は全部無効扱い
    if (v == null) return null;
    const s = String(v).trim();
    if (!s || s === "undefined" || s === "null") return null;

    return s;
  } catch {
    return null;
  }
}

function normalizeToPath(to, fallback) {
  const fb = typeof fallback === "string" && fallback.startsWith("/") ? fallback : "/";

  if (typeof to !== "string") return fb;

  const s = to.trim();
  if (!s || s === "undefined" || s === "null") return fb;

  // 今回の事故を確実に潰す
  if (s === "/undefined") return fb;

  // 変なURL弾く（外部URLや相対パス）
  if (!s.startsWith("/")) return fb;

  return s;
}

export function navigate(to, fallback = "/") {
  const dest = normalizeToPath(to, fallback);

  // 犯人特定用（ログがうるさければ消してOK）
  console.log("[navigate] to=", to, "=>", dest);
  console.trace("[navigate trace]");

  window.location.assign(dest);
}